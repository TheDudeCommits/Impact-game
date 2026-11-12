import * as THREE from 'three';
import {BallGear,patchBallSkin,type Emit} from './ballCosmetics';
import type {GameSnapshot} from '../../game/types';
import {BALL_TEAM_COLOURS,CHARM_COLOURS,GOAL_RULES,SHOOT,SPIKE_RULES,ballOf,ballRadius,heatTier,spikeCourt,type BallEvent,type BallModeId,type BallSeat,type BallState,type BallTeam,type BallView} from '../../game/ball/model';
import {courtSide,landing,stepBall,type BallContact} from '../../game/ball/physics';
import {CARRY,carrySpot} from '../../game/ball/BallMatch';
import type {TouchForecast} from '../../game/ball/touchForecast';
import {noiseTexture} from '../vfx/noiseTexture';
import {VFX} from '../vfxLevel';
import {VfxKit} from '../vfx/VfxKit';
import {SPRITE,inkImpactsReady} from '../vfx/SparkField';
import {INK_IMPACTS,type InkImpact} from '../vfx/inkImpactAtlas';
import {GroundMarks,MARK} from '../vfx/GroundMarks';
import {BallCharms} from './BallCharms';
import {BallTags} from './BallTags';
import {arenaMood,crowdHype} from './hype';
import {FOOT_SAND_RED,sideRing} from './TeamTrim';
import {MOTIF_RATE,fighterColour,superLook} from './superShotLooks';
import {AimLine} from './aimLine';
import {FightMarks} from './FightMarks';
import type {FighterId} from '../../game/types';

/** Points in the trail, effects in the pool, and the instances drawn each frame beyond the pool (the shadow, the
 *  landing ring, the stopped clock). */
const TRAIL=40,CAP=900,EXTRA=10;
/** The landing ring closes on its spot from this many metres a second of flight left (less of it on the volleyball
 *  rules' smaller court). */
const LAND_CLOSE={classic:2.2,volley:1.1} as const;
/** On the volleyball rules no body is named (less on screen): your own ring under your feet, doubled, marks you. */
const noTag=(seat:BallSeat)=>!seat;
/** Football: a team-mate's name tag (only the one a PASS would go to now) at this share of its size. */
const FOOT_TAG=.72;
/** One pooled effect's floats: where, its velocity, its age and life, its size from and to, colour and alpha, its
 *  kind, turn and spin, drag, gravity, a seed, how far it stretches and along what, and its flags. */
const F=25,PX=0,PY=1,PZ=2,VX=3,VY=4,VZ=5,AGE=6,LIFE=7,S0=8,S1=9,CR=10,CG=11,CB=12,CA=13,KIND=14,ROT=15,SPIN=16,DRAG=17,GRAV=18,SEED=19,STRETCH=20,FLAGS=21,AX=22,AY=23,AZ=24;
/** What each pooled effect is drawn as (the fragment shader's branches). 20 and up lie flat on the floor. */
const K={spark:0,smoke:1,burst:2,ring:3,petal:4,confetti:5,streak:6,shield:7,chunk:8,glint:9,clock:10,bolt:11,
  // A manga cloud, a column off the floor. (12, 13, 16 and 24 are free: a touch's mark is one of the engine's drawn
  // impacts now, `ink` below.)
  cloud:14,pillar:15,
  groundRing:20,splat:21,shadow:22,landing:23,side:25,
  // A TRAP's ring closing on the ball's foot.
  settle:26} as const;
/** The kinds drawn in the covering layer (ink and paper over what is behind them), before the light. */
const COVERS=new Uint8Array(32);for(const k of [K.smoke,K.petal,K.confetti,K.chunk,K.burst,K.cloud,K.pillar])COVERS[k]=1;
/** Stretched along its own flight, stretched along a fixed axis, stopped by the floor, fluttering as paper falls. */
const ALONG_FLIGHT=1,ALONG_AXIS=2,FLOOR=4,FLUTTER=8;
/** Seconds the drawn ball may run ahead of its last snapshot; the time constant a correction is blended out over
 *  (gone by about 80 ms); a jump between snapshots beyond any flight that is a reset (a kickoff, a serve's walk-up). */
const AHEAD=.12,BLEND=.028,SNAP=4;
/** The page's own touch, drawn at once (`forecastTouch`): how long the room's ball is kept (s); the time
 *  constants (s) of the spring the forecast's miss is blended out by when the room agrees with it, and when it refuses it
 *  (somebody else's touch got there first, the swing found nothing) - gentler; how long the page waits to hear its touch
 *  back: past the room's time for it (its prediction's clock as it struck) HEARD_PAST, reaching HEARD_BACK before it (the
 *  room can play a backlog of commands a few ticks sooner), or HEARD after the frame it was forecast on where that time
 *  is not known. The lead the ball is drawn with after the page's own touch is eased off at LEAD_EASE (the share of the
 *  frame's time: the ball runs at least 1 - most of its pace meanwhile, the rate itself settling over 1/settle s), done
 *  before the flight brings it within LEAD_MEET metres of any other fighter (looking LEAD_LOOK s ahead), held while it
 *  is on its way to the page's own. */
const RING=1.2,MEND=.07,REFUSED=.12,HEARD=.42,HEARD_PAST=.1,HEARD_BACK=.12,LEAD_EASE={least:.15,most:.6,settle:10},LEAD_MEET=2.4,LEAD_LOOK=1.2;

const TEAM:Record<BallTeam,THREE.Color>={red:new THREE.Color(BALL_TEAM_COLOURS.red),blue:new THREE.Color(BALL_TEAM_COLOURS.blue)};
/** The red side's rings on the sand (TeamTrim.ts FOOT_SAND_RED). */
const SAND_RED=new THREE.Color(FOOT_SAND_RED.ring);
const NEUTRAL=new THREE.Color(.9,.92,1),WHITE=new THREE.Color(1,1,1),INK=new THREE.Color(.012,.012,.016),GOLD=new THREE.Color(1,.72,.28);
const DUST=new THREE.Color(.42,.38,.33),PINK=new THREE.Color(1,.62,.76),PALE=new THREE.Color(.75,.9,1),CLOCK=new THREE.Color(.92,.92,.96);
/** The manga clouds' paper - cold, warmed by a burning ball, and the grey of a ball at OVERDRIVE's smoke. */
const PAPER=new THREE.Color(.95,.93,.88),WARM=new THREE.Color(1,.84,.66),ASH=new THREE.Color(.55,.52,.5);
/** How bright the fire round a hot ball burns (its HDR; the frame's bloom and diffusion spread anything much over one
 *  across the ball itself, which is what washed it out), scaled down on the lower VISUAL EFFECTS levels. */
const FIRE_GLOW=.55;
/** How hard a strike was (0.12-1.2), from the ball's speed off it (m/s): a 12 m/s pass is a spark, a 35 m/s
 *  power shot a blast. */
const strikePower=(value:number|undefined)=>Math.min(1.2,Math.max(.12,((value??15)-8)/28));
/** One clear mark a touch: a strike under SOFT of that power (about 18 m/s) is a puff; from
 *  HARD (30 m/s: BallMoments' power shot) a real burst, and its path is left hanging as a stroke. */
const SOFT=.36,HARD=.78;
/** The drawn marks' scale (m) by the mode's ball - its radius and a little more, so Sky Spike's smaller ball
 *  under its farther, higher lens still leaves a mark that reads. Every touch's mark is sized from it. (The first cut
 *  sized them from the ball alone: from the match's lens, 20 m off and more, a power shot's burst was under two balls
 *  across and gone in a sixth of a second - smaller than the ball's own flash.) */
const markScale=(r:number)=>.6+r;
/** A pitch that remembers: how long a mark stays on the floor (s; it fades over the last 45% of that), how
 *  many lie at a time by quality, and how soon one body may leave another skid (s). */
const MARKS={life:60,most:{high:48,medium:32,low:14},skidGap:.6} as const;
/** A ball with character. How far it flattens along a blow at contact (of its width, a full-power one) and
 *  for how long (s); how far it lengthens along its flight (at most `stretch`, from `from` m/s, reached over `over` m/s
 *  more) - its volume kept, so it is never slimmer than nine tenths: still a ball. The spin (rad/s) its turning lines
 *  come in at and are whole at. How big on screen (its width over the frame's height) it starts to thin to its outline
 *  where it crosses the lens, and is all outline: above what close play shows (filmed in bot play, a ball at a player's
 *  feet in front of Goal Rush's lens is a fifth to under a third of the frame; one flying past the lens, half to three
 *  quarters), so the ball you are playing never thins. The stroke a power shot's path leaves: how long it hangs (s), how long
 *  it is drawn for after the strike (s), the gap between its points and its width (m, by the ball's radius). */
const SHAPE={squash:.3,squashFor:.14,stretch:.18,from:12,over:90,spinFrom:2.5,spinFull:6.5,thinFrom:.3,thinFull:.45,strokeFor:1,strokeDraw:.9,strokeGap:.8,strokeWidth:.7} as const;
/** Goal Rush's carried ball (BallMatch CARRY; whose it is, BallState.carry). The room has it at its carrier's
 *  feet (`carrySpot`); the page draws it at the carrier's DRAWN feet, rolling as the drawn body runs - online the page's
 *  own fighter is drawn ahead of the room's ball by the page's lag, and the room's ball trailed it by about a metre.
 *  CARRY_DRAW: how long (s) the drawn ball takes to come onto the feet as a carry begins (`in`; from further off, at
 *  `inPace` m/s, up to `inMost` - a page's own fighter drawn a lag ahead of a carry it did not forecast), and to blend what lies between
 *  the feet and the room's flight out as it ends (a miss over `near` m; a smaller one, the frame's own, over `settle`:
 *  the room's flight is the truth from there, and the answers' gentler spring held a carried place a third of a second
 *  past it); how fast
 *  (rad/s) the way it sits round a body follows the room's (which turns it at CARRY.turn) - for the page's own fighter
 *  drawn ahead of the room, the drawn body's own run from `run` m/s, at half as fast again as the room turns it (a run's
 *  way lags the stick's a little; slower, it holds where it was); and
 *  the one sign of whose ball it is, a ring in the carrier's side's colour on the floor round it - its card's size (by the
 *  ball's radius; the band lies at 0.8 of it, half a metre clear of the ball's foot, or the ball itself hides it from the
 *  match's lens past ten metres) and strength. */
/** SPORT mode (game/ball/football.ts): the ball's ring on the floor at least this wide (m), lit whatever its height. */
const FOOT_RING=.5;
/** SPORT mode: the drawn ball (only: the rules' ball is the room's) is never under FOOT_FLOOR px tall on the screen - 12 at
 *  720 px of height, 9 at 390, in between by the height - so a 0.6 m ball 35 m off still reads (it was 8.7 px at 1280 x
 *  720 and 4.7 at 844 x 390). The radius to draw `r` at, from `camera` (a perspective lens) to `at`. */
const FOOT_FLOOR={high:720,highPx:17,low:390,lowPx:13} as const;
/** So the ball is never a few pixels wide or lost under bodies or rings - the sport rules' football (BallView.football)
 *  only - the ball the clearest thing on screen:
 *  - never under `highPx` px across at 720 px of height (`lowPx` at 390, in between by the height), however far it is;
 *  - its ink line at least `ink` px and a white halo `halo` px wide outside it, whole (`alpha`);
 *  - drawn over every body (and every floor mark): no body hides it at a touch or a tackle - its halo, ink and face in
 *    that order over the rest of the frame (`order`);
 *  - its shadow always under it, at least `shadowAlpha` dark;
 *  - its ribbon only off a ball struck at `trailFrom` m/s or more (a shot, a long ball: full at `trailFull`), `trailLife` s
 *    long - a dribble and a short pass leave none. */
/** So the person's mark is not a big double ring and team-mates' and rivals' rings do not look alike - football only:
 *  the rings on the floor under the bodies - your own a single thin one (`own` m across, `ownAlpha` strong; the arrow
 *  over your head is your mark), a team-mate's smaller and faint (`mate`, `mateAlpha`), none under a rival (their kits
 *  say whose they are). */
const FOOT_RINGS={own:.95,ownAlpha:.75,mate:.78,mateAlpha:.3} as const;
const FOOT_DRAW={highPx:24,lowPx:17,ink:1.7,halo:2.6,alpha:1,order:30,shadowAlpha:.48,trailFrom:17,trailFull:24,trailLife:.24} as const;
function footDrawn(r:number,camera:THREE.Camera,at:{x:number;y:number;z:number}){
  const lens=camera as THREE.PerspectiveCamera,h=typeof innerHeight==='number'&&innerHeight>0?innerHeight:720;
  if(!lens.isPerspectiveCamera)return r;
  const F=FOOT_FLOOR,px=FOOT_DRAW.lowPx+(FOOT_DRAW.highPx-FOOT_DRAW.lowPx)*THREE.MathUtils.clamp((h-F.low)/(F.high-F.low),0,1);
  const d=Math.hypot(at.x-lens.position.x,at.y-lens.position.y,at.z-lens.position.z),least=px*d*Math.tan(lens.fov*Math.PI/360)/h;
  return Math.max(r,least);
}
/** So big ink and ghost effects never cover the action: on the sport rules' football a touch's mark, a save's, a post's
 *  - every moment's but a goal's - is drawn at `size` of its size and `life` of its life: small and short, at the
 *  touch. */
const FOOT_QUIET={size:.6,life:.7} as const;
/** So a body is seen touching the ball as it runs with it: the carried ball drawn as a dribble (BallField.dribble) -
 *  from a run of `from` m/s, each second stride of a foot at the front of its stride (`front` m ahead of the body or
 *  more) meets the ball `meet` ball radii in front of it and sends it `out` m on plus `outPer` a m/s of the run (at
 *  most `outMost`) over a stride pair of `least`-`most` s (`pace` m of run a touch without feet to read). */
const FOOT_DRIBBLE={from:2.2,front:.12,meet:1.1,out:.16,outPer:.04,outMost:.48,least:.38,most:.8,pace:2.6,period:.55,ease:30,kick:.7} as const;
/** So the ball is at the feet, not beside the person - football: the carried ball is drawn in front of the carrier's
 *  drawn body along its own facing, turned with it at up to `turn` rad/s; and the dribble's touches go only so far out
 *  (FOOT_DRIBBLE `out`, `outPer`, `outMost`: about 0.45 m at a run) - at the close camera the touch reads, and the ball
 *  stays at the feet. */
const FOOT_CARRY={turn:40} as const;
/** So the kick and the dribble's touches read at play distance, not only in close crops: on football each PASS and SHOOT is swept by one crescent - the engine's drawn blade arc, white with the
 *  side's colour at its edge - through where the ball was struck, along the kick, `y` m up and `back` m behind the
 *  ball: `size` m (a pass) to `size + power` (a full shot), up `life` to `life + lifePower` s, never quieted
 *  (FOOT_QUIET) nor shrunk or dimmed by the SPORT stance's caps (vfxLevel.ts SPORT_VFX spriteSize, spriteGain: at 0.65
 *  each a crescent does not show at play distance). The dribble's touches go further out (FOOT_DRIBBLE `out`, `outPer`, `outMost`: about 0.7 m at a run,
 *  not 0.4), so the ball is seen to leave the foot and come back to it. */
const KICK_ARC={size:.8,power:.6,y:.45,back:.3,life:.17,lifePower:.08,heat:2.4} as const;
/** A ball easy to follow - not a small gold disc lost against the crowd and banners with no shadow - VOLLEYBALL only
 *  (`view.volley`): the drawn ball (only: the rules' ball is the room's) `scale` times its size and never under
 *  `highPx` px tall at 720 px of height (`lowPx` at 390, in between by the height), white with blue and yellow panels
 *  and a thicker ink line (`outline`, of its size) so it reads on the court, the crowd and the sky alike; its shadow
 *  always under it (at least `shadow` m across and `shadowAlpha` dark, with its finding ring from `ringFrom` m up); its
 *  ribbon only off a ball struck at `trailFrom` m/s or more (a spike, a JUMP SERVE, a STUFF), `trailLife` s long - a
 *  pass and a set leave none. */
const VOLLEY_DRAW={scale:1.15,high:720,highPx:20,low:390,lowPx:14,outline:1.12,shadow:.62,shadowAlpha:.5,ringFrom:1.2,trailFrom:13,trailLife:.26} as const;
function volleyDrawn(r:number,camera:THREE.Camera,at:{x:number;y:number;z:number}){
  const lens=camera as THREE.PerspectiveCamera,h=typeof innerHeight==='number'&&innerHeight>0?innerHeight:720,V=VOLLEY_DRAW,big=r*V.scale;
  if(!lens.isPerspectiveCamera)return big;
  const px=V.lowPx+(V.highPx-V.lowPx)*THREE.MathUtils.clamp((h-V.low)/(V.high-V.low),0,1);
  const d=Math.hypot(at.x-lens.position.x,at.y-lens.position.y,at.z-lens.position.z),least=px*d*Math.tan(lens.fov*Math.PI/360)/h;
  return Math.max(big,least);
}
/** VOLLEYBALL only: the ball met by the body that plays it. The rules strike the ball from up to two metres off the
 *  body (VOLLEY.reach and its step), so a receive left the ball beside a fighter and the touch read as a ring, not a
 *  pair of forearms. The drawn ball (only) is drawn onto the toucher's hands for the touch: from the swing's start
 *  (SHOOT's quick strike, its contact SHOOT.contact later) it comes onto them by the contact and leaves them over `after`
 *  s, its true flight underneath. The hands, by the touch's take (`volley.takes`): `fwd` m in front of the body toward the
 *  ball, `up` m over its feet - the forearms at the waist for a receive, over the head for a set, the hitting hand high
 *  for a spike, a serve and a TIP; never pulled more than `most` m (a touch the rules cancelled). The dig's on its
 *  platform of straight arms (the dig take's), a little further out in front of the hips. */
const MEET={after:.13,most:2.2,hands:{
  'SS.dig':{fwd:.65,up:.9},'SS.set':{fwd:.2,up:2.15},'SS.backSet':{fwd:.1,up:2.15},'SS.setAir':{fwd:.25,up:2.1},'SS.float':{fwd:.35,up:1.95},
  'SS.jumpServe':{fwd:.35,up:2.05},'SS.spike':{fwd:.4,up:2.05},'SS.spikeCut':{fwd:.4,up:2.05},'SS.spikeRoll':{fwd:.4,up:2.05},'SS.tip':{fwd:.35,up:2.1}} as Record<string,{fwd:number;up:number}>} as const;
/** So effects never drown the action (FEVER petals across the screen, speed lines, white flashes), VOLLEYBALL only:
 *  each drawn impact `ink` its size and `life` its time, never hotter than `heat`; a hard strike leaves no
 *  hanging stroke and throws no manga smoke or white streaks (the short ribbon is its path: VOLLEY_DRAW); FEVER throws no
 *  petals, and the place's mood at its peak is held to `mood`. The burst a third smaller and shorter again - at the
 *  closer stand a bigger one covers the hitter, the ball and the net. */
const VOLLEY_FX={ink:.32,life:.6,heat:1.5,mood:.3} as const;
const CARRY_DRAW={in:.12,inMost:.2,inPace:5,out:.16,settle:.025,near:.35,follow:18,run:1.2,ring:2,alpha:.9} as const;
/** A TRAP's mark (BallMatch TRAP): how long its ring closing on the ball lasts (s), where it starts and ends
 *  (by the ball's radius: it ends on the carried ball's own ring, CARRY_DRAW.ring's band), its strength, and how hard the
 *  ball is pressed down onto the turf (of a blow's). */
const TRAP_MARK={life:.34,from:2.6,to:1.6,alpha:.85,press:.4} as const;
const wrapAngle=(a:number)=>Math.atan2(Math.sin(a),Math.cos(a));
const UP=new THREE.Vector3(0,1,0);
const smooth=(x:number,a:number,b:number)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};
/** The light a burning ball throws, by heat tier (none cold). */
const HEAT_LIGHT=[0,0xffb060,0xff7a1a,0xff3a1a,0xb46bff] as const;
const TREES:readonly (readonly [number,number])[]=[[1,1],[1,-1],[-1,1],[-1,-1]].map(([sx,sz])=>[sx*(SPIKE_RULES.halfX+1.6),sz*(SPIKE_RULES.halfZ+1.7)] as const);

const blankBall=():BallState=>({x:0,y:0,z:0,vx:0,vy:0,vz:0,sx:0,sy:0,sz:0,heat:0,lastId:null,lastTeam:null,shot:null,held:true,frozenUntil:0,super:false,size:1,grav:1,wall:null,clash:0});
function copyBall(to:BallState,from:BallState){
  to.x=from.x;to.y=from.y;to.z=from.z;to.vx=from.vx;to.vy=from.vy;to.vz=from.vz;to.sx=from.sx;to.sy=from.sy;to.sz=from.sz;
  to.heat=from.heat;to.lastId=from.lastId;to.lastTeam=from.lastTeam;to.shot=from.shot;to.held=from.held;to.frozenUntil=from.frozenUntil;to.super=from.super;to.size=from.size??1;to.grav=from.grav??1;to.wall=from.wall??null;to.clash=from.clash??0;to.link=from.link??null;
  // (The arena's floor and wind - arenas.ts twist - which the flight reads.)
  to.ground=from.ground;to.spring=from.spring;to.windX=from.windX;to.windZ=from.windZ;
  // (Whose carried ball it is - what the page draws at their feet, and what the page's own forecast reads:
  // dropped here, the forecast never knew its own fighter carried the ball, took it on again whenever its body met the
  // drawn one - 13 times in four carries online at 120 ms, three refused - and would strike it as a moving ball.)
  to.carry=from.carry;
  return to;
}
const sameBall=(a:BallState,b:BallState)=>a.x===b.x&&a.y===b.y&&a.z===b.z&&a.vx===b.vx&&a.vy===b.vy&&a.vz===b.vz&&a.held===b.held&&a.frozenUntil===b.frozenUntil&&a.heat===b.heat&&a.lastTeam===b.lastTeam&&a.super===b.super&&a.size===b.size&&a.grav===b.grav&&a.wall===b.wall&&a.clash===b.clash&&(a.link??null)===(b.link??null)&&a.carry===b.carry;
const PREMULTIPLIED={transparent:true,depthWrite:false,forceSinglePass:true,blending:THREE.CustomBlending,blendSrc:THREE.OneFactor,blendDst:THREE.OneMinusSrcAlphaFactor} as const;
const golden=(1+Math.sqrt(5))/2;
const unit=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z).normalize();

/** The trail's history, newest first: where the ball was drawn, when, how wide the ribbon is there and in whose colour. */
class Trail{
  readonly x=new Float32Array(TRAIL);readonly y=new Float32Array(TRAIL);readonly z=new Float32Array(TRAIL);readonly t=new Float32Array(TRAIL);
  readonly w=new Float32Array(TRAIL);readonly r=new Float32Array(TRAIL);readonly g=new Float32Array(TRAIL);readonly b=new Float32Array(TRAIL);
  /** A second colour along the ribbon's other edge (a SUPER SHOT's two, a LINK SHOT's two fighters). */
  readonly r2=new Float32Array(TRAIL);readonly g2=new Float32Array(TRAIL);readonly b2=new Float32Array(TRAIL);
  head=0;count=0;
  slot(i:number){return (this.head-i+TRAIL*2)%TRAIL;}
  set(i:number,p:THREE.Vector3,t:number,w:number,c:THREE.Color,c2=c){const s=this.slot(i);this.x[s]=p.x;this.y[s]=p.y;this.z[s]=p.z;this.t[s]=t;this.w[s]=w;this.r[s]=c.r;this.g[s]=c.g;this.b[s]=c.b;this.r2[s]=c2.r;this.g2[s]=c2.g;this.b2[s]=c2.b;}
  push(p:THREE.Vector3,t:number,w:number,c:THREE.Color,c2=c){this.head=(this.head+1)%TRAIL;this.count=Math.min(TRAIL,this.count+1);this.set(0,p,t,w,c,c2);}
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
  /** (`stroke` lays it as a brush does - broad where it began, a thin flick where it ends.) */
  build(trail:Trail,eye:THREE.Vector3,clock:number,life:number,widthScale:number,stroke=false){
    const n=trail.count,pos=this.position.array as Float32Array,col=this.colour.array as Float32Array;
    if(n<2){this.mesh.geometry.setDrawRange(0,0);return;}
    let sx=0,sy=1,sz=0;
    for(let i=0;i<n;i++){
      const s=trail.slot(i),a=trail.slot(Math.max(0,i-1)),b=trail.slot(Math.min(n-1,i+1));
      const px=trail.x[s],py=trail.y[s],pz=trail.z[s],tx=trail.x[a]-trail.x[b],ty=trail.y[a]-trail.y[b],tz=trail.z[a]-trail.z[b];
      const vx=eye.x-px,vy=eye.y-py,vz=eye.z-pz,cx=ty*vz-tz*vy,cy=tz*vx-tx*vz,cz=tx*vy-ty*vx,cl=Math.hypot(cx,cy,cz);
      if(cl>1e-6){sx=cx/cl;sy=cy/cl;sz=cz/cl;}
      const u=i/(n-1),fade=Math.max(0,1-(clock-trail.t[s])/life),w=trail.w[s]*widthScale*(stroke?.25+.75*Math.pow(u,.6):Math.sqrt(1-u))*.5*(.45+.55*fade);
      pos[i*6]=px+sx*w;pos[i*6+1]=py+sy*w;pos[i*6+2]=pz+sz*w;pos[i*6+3]=px-sx*w;pos[i*6+4]=py-sy*w;pos[i*6+5]=pz-sz*w;
      const alpha=stroke?Math.min(1,fade*2.5):fade*(1-u*.4);
      col[i*8]=trail.r[s];col[i*8+1]=trail.g[s];col[i*8+2]=trail.b[s];col[i*8+3]=alpha;
      col[i*8+4]=trail.r2[s];col[i*8+5]=trail.g2[s];col[i*8+6]=trail.b2[s];col[i*8+7]=alpha;
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
        varying vec2 vP;varying vec4 vCol;varying vec4 vMisc;varying vec4 vAxis;varying float vDepth;
        void main(){
          vP=position.xy;vCol=aCol;vMisc=aMisc;vAxis=aAxis;
          vec3 centre=(modelMatrix*vec4(aPos.xyz,1.)).xyz;
          float c=cos(aMisc.z),s=sin(aMisc.z),kind=aMisc.x,size=aPos.w;
          vec4 mv;
          if(kind>19.5){vec2 q=mat2(c,s,-s,c)*position.xy*size;mv=viewMatrix*vec4(centre+vec3(q.x,0.,q.y),1.);}
          else{
            mv=viewMatrix*vec4(centre,1.);
            // A card standing up to the lens is never more than a share of the frame's height across (a ring
            // up to most of it; a cloud or a burst about half), so a moment beside the lens frames the play instead
            // of filling the screen with a band or a blob.
            float cap=kind>2.5&&kind<3.5?.95:(kind>.5&&kind<2.5)||(kind>13.5&&kind<14.5)?.5:1e4;
            size=min(size,max(-mv.z,.05)/projectionMatrix[1][1]*cap);
            if(aAxis.w>0.){
              vec3 d=(viewMatrix*vec4(aAxis.xyz,0.)).xyz;float l=length(d.xy);
              vec2 along=l>1e-4?d.xy/l:vec2(1.,0.),across=vec2(-along.y,along.x);
              mv.xy+=along*position.x*size*aAxis.w+across*position.y*size;
            }else mv.xy+=mat2(c,s,-s,c)*position.xy*size;
          }
          vDepth=-mv.z;
          gl_Position=projectionMatrix*mv;
        }`,
      fragmentShader:`uniform sampler2D uNoise;uniform float uTime;
        varying vec2 vP;varying vec4 vCol;varying vec4 vMisc;varying vec4 vAxis;varying float vDepth;
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
            // A ring of light racing out and thinning (thin from its start: a thick one read as a band).
            float rr=mix(.25,.95,sqrt(t)),w=mix(.075,.018,t),px=fwidth(r)+.002;
            rgb=col*(1.-smoothstep(w-px,w+px,abs(r-rr)))*al*(1.-t)*1.7;
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
          }else if(kind<14.5){
            // A manga cloud: a lumpy puff of paper rimmed in ink (dust, smoke, the trail a fast ball leaves),
            // lit from above, wearing away from its thin side as it dies.
            float n=texture2D(uNoise,p*.3+vec2(seed*5.3,seed*2.9)+t*.05).g;
            float lumps=.1*sin(a*5.+seed*20.)+.06*sin(a*9.-seed*13.+t*2.)+(n-.5)*.16;
            float edge=.74+lumps,px=fwidth(r)*1.2+.012;
            float keep=smoothstep(t*1.1-.12,t*1.1+.02,n*.7+.3*(1.-r/edge));
            float body=(1.-smoothstep(edge-px,edge+px,r))*keep;
            float rim=1.-smoothstep(edge-.11-px,edge-.11+px,r);
            vec3 fill=col*mix(.78,1.05,smoothstep(-.6,.6,p.y+n*.3));
            cover=body*al*(1.-smoothstep(.75,1.,t));
            rgb=mix(fill,vec3(.02,.02,.025),(1.-rim)*.92)*cover;
          }else if(kind<15.5){
            // A column thrown up off the floor (a goal, a spike slammed in): the card stands along the world's up
            // (vP.x up it), ragged at its sides, shooting up then breaking off at its foot; a hot heart in its colour,
            // ink at its edges.
            float up=p.x*.5+.5,n=texture2D(uNoise,vec2(p.y*.4+seed,up*1.3-t*1.4)).g;
            float top=min(1.,sqrt(t*3.2)),foot=smoothstep(.45,1.,t);
            float w=mix(.62,.2,up)*(.8+.4*n)*(1.+up*t*.6);
            float px=fwidth(p.y)+.01;
            float body=(1.-smoothstep(w-px,w+px,abs(p.y)))*step(foot*.9,up)*(1.-smoothstep(top-.08,top,up));
            float heart=1.-smoothstep(w*.38,w*.62,abs(p.y));
            cover=body*al*(1.-smoothstep(.7,1.,t));
            rgb=mix(vec3(.015),mix(col*2.2,vec3(3.),heart*(1.-up)*.6),heart)*cover;
          }else if(kind<20.5){
            // A shockwave along the floor (a crisp line in its colour on a broken ink band, where a fat white band
            // lay on the turf like a painted ellipse).
            float e=1.-(1.-t)*(1.-t),rr=mix(.18,.97,e),w=mix(.06,.012,e),px=fwidth(r)+.002;
            float gap=smoothstep(.18,.3,texture2D(uNoise,vec2(a*.45+seed*3.,seed*2.3)).r);
            float line=1.-smoothstep(w-px,w+px,abs(r-rr)),band=1.-smoothstep(w+.03-px,w+.03+px,abs(r-rr));
            float fade=al*(1.-t)*gap;
            cover=band*fade*.7;
            rgb=col*1.5*line*fade;
          }else if(kind<21.5){
            // An ink crater where the ball came down: a black splash with droplets thrown out, rimmed in colour (with
            // cracks running out past it across the floor).
            float s=pow(abs(sin(a*3.5+seed*10.)),6.)*(.5+.5*texture2D(uNoise,vec2(a*.5+seed,.3)).b);
            float reach=.4+.42*s,body=1.-smoothstep(reach-.03,reach,r),drops=0.;
            for(int i=0;i<6;i++){float fi=float(i),an=seed*6.28+fi*1.047+h1(seed+fi)*.6,dist=.68+.24*h1(seed*3.+fi);
              drops=max(drops,1.-smoothstep(.05,.08,length(p-dist*vec2(cos(an),sin(an)))));}
            float rim=smoothstep(reach-.16,reach-.07,r)*body;
            float crack=step(.94,fract(a*1.9+seed*3.))*step(r,.34)*step(.1,r);
            float slots=9.,f=a*.15915494*slots+seed*4.,cell=floor(f),jag=(texture2D(uNoise,vec2(r*2.2+cell,seed)).r-.5)*.5;
            float run=(1.-smoothstep(.02,.05,abs(fract(f)-.5+jag*.3)*r*.7))*step(reach-.05,r)*(1.-smoothstep(.62+.3*h1(cell+seed*9.),.98,r))*step(.35,h1(cell*2.3+seed));
            vec3 c=mix(vec3(.012),col*1.3,rim);c=mix(c,vec3(.8),crack*.55);
            cover=max(max(body,drops),run*.9)*al*(1.-smoothstep(.7,1.,t));
            rgb=c*cover;
          }else if(kind<22.5){
            // The ball's shadow, and a fine ring to find it by when the ball is high (its strength in vAxis.x).
            cover=(1.-smoothstep(.15,1.,r))*al;
            rgb=vec3(.9)*(1.-smoothstep(.02,.05,abs(r-.9)))*vAxis.x;
          }else if(kind<23.5){
            // Where the ball comes down (drawn fine, as a sight rather than a painted band): a fine ring on an ink
            // hairline, four ticks pointing in and turning slowly, a dot at its heart, a faint fill, a cross when it lands
            // out. The card shrinks as the ball falls, so the ring closes on the spot.
            float px=fwidth(r)+.002;
            float ring=1.-smoothstep(.026-px,.026+px,abs(r-.88)),hair=1.-smoothstep(.055-px,.055+px,abs(r-.88));
            vec2 q=abs(p);
            float tick=max((1.-smoothstep(.024-px,.024+px,q.y))*step(.6,q.x)*step(q.x,.8),(1.-smoothstep(.024-px,.024+px,q.x))*step(.6,q.y)*step(q.y,.8));
            float tickInk=max((1.-smoothstep(.05-px,.05+px,q.y))*step(.57,q.x)*step(q.x,.83),(1.-smoothstep(.05-px,.05+px,q.x))*step(.57,q.y)*step(q.y,.83));
            float heart=1.-smoothstep(.065-px,.065+px,r),heartInk=1.-smoothstep(.1-px,.1+px,r);
            vec2 d=vec2(p.x+p.y,p.x-p.y)*.7071;
            float xmark=vAxis.y*(1.-smoothstep(.035,.06,min(abs(d.x),abs(d.y))))*step(r,.55);
            float fill=(1.-smoothstep(.2,.88,r))*.1;
            cover=(max(max(hair,tickInk),heartInk)*.7+fill)*al;
            rgb=col*(ring*1.7+tick*1.5+heart*1.4+xmark*1.5+fill*.4)*al;
          }else if(kind<25.5){
            // A fighter's side, on the floor under them: a ring in the side's colour on an ink edge - brighter and with a
            // second, finer ring outside it under your own (vAxis.x).
            float own=vAxis.x,px=max(fwidth(r),.004);
            float band=1.-smoothstep(.055,.055+px,abs(r-.8)),edge=1.-smoothstep(.1,.1+px,abs(r-.8));
            float outer=own*(1.-smoothstep(.022,.022+px,abs(r-.95)));
            cover=max(edge*.6,outer*.5)*al;
            rgb=col*(band*(.85+own*.75)+outer*1.3)*al;
          }else{
            // A TRAP: a thin ring in the trapper's side's colour on an ink edge, closing in from the card's rim
            // to the ball's foot (vAxis.x, of the card) as the ball is killed dead, coming in and gone at its ends.
            float e=1.-(1.-t)*(1.-t),rr=mix(.96,vAxis.x,e),px=max(fwidth(r),.004),w=mix(.03,.05,e);
            float line=1.-smoothstep(w,w+px,abs(r-rr)),edge=1.-smoothstep(w+.035,w+.035+px,abs(r-rr));
            float fade=al*smoothstep(0.,.1,t)*(1.-smoothstep(.65,1.,t));
            cover=edge*.6*fade;
            rgb=col*line*1.5*fade;
          }
          // What stands up to the lens fades out as the lens closes on it (gone a metre off), so a burst or a cloud
          // the ball carries past the camera never washes the whole frame.
          if(kind<19.5){float near=smoothstep(1.,3.2,vDepth);rgb*=near;cover*=near;}
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
      const kind=d[o+KIND],flat=kind>19.5,covers=COVERS[kind]===1;
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
 *  Snapshots come 30 times a second online (60 on this device) and the page draws at its own rate, so the ball is drawn
 *  where it is at the frame's own time: the snapshot before the frame run on along its own flight (the sim's stepBall:
 *  its gravity, drag, spin, the walls and the floor) by the frame's time since that snapshot was sampled, and what that
 *  flight misses the next snapshot by (a touch between them) blended in across the gap, so the ball meets every
 *  snapshot on time and never steps back. (It used to run on from when the snapshot reached the page and carry the
 *  last frame's place over as a correction; on a 60 Hz screen that held the ball still until it was 4 m behind, then
 *  jumped it. ballSmooth.test.ts measures it.) A held ball moves from hand to hand; a stopped one (frozenUntil)
 *  stands still, drained to grey, with a clock round it. Everything is built once and pooled: a frame
 *  allocates nothing (save the landing forecast, once a snapshot). */
export class BallField {
  readonly root=new THREE.Group();
  private readonly ball=new THREE.Group();private readonly spinner=new THREE.Group();
  /** This moment's marks' share of their size (FOOT_QUIET; 1 off football). */
  private quiet=1;
  private readonly bodyMaterial:THREE.ShaderMaterial;
  /** (A shader of its own where it was a basic material, so the hull can thin to a line with the ball -
   *  `uThin`, below.) */
  private readonly outlineMaterial=new THREE.ShaderMaterial({name:'Ball ink outline',side:THREE.BackSide,uniforms:{uColor:{value:new THREE.Color(0x050506)},uThin:{value:0}},
    vertexShader:`varying vec3 vN;varying vec3 vV;void main(){vN=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.);vV=-mv.xyz;gl_Position=projectionMatrix*mv;}`,
    fragmentShader:`uniform vec3 uColor;uniform float uThin;varying vec3 vN;varying vec3 vV;
      void main(){float edge=1.-abs(dot(normalize(vN),normalize(vV)));gl_FragColor=vec4(uColor,mix(1.,smoothstep(.45,.75,edge),uThin));}`});
  private readonly sphere=new THREE.SphereGeometry(1,40,28);
  private readonly outline=new THREE.Mesh(this.sphere,this.outlineMaterial);
  /** Football's white halo outside the ink line (FOOT_DRAW). */
  private readonly haloMaterial=new THREE.MeshBasicMaterial({name:'Ball halo',color:0xffffff,side:THREE.BackSide,transparent:true,opacity:FOOT_DRAW.alpha,depthWrite:false,toneMapped:false});
  /** The football ball drawn over everything (FOOT_DRAW.order) - set while it is. */
  private onTop=false;
  private readonly halo=new THREE.Mesh(this.sphere,this.haloMaterial);
  private bodyMesh!:THREE.Mesh;
  /** The ball drawn over the body meeting it (MEET: a body between the lens and the ball - your own side's, from
   *  behind - would hide the touch it is making). */
  private overBody=false;
  private readonly auraMaterial:THREE.ShaderMaterial;private readonly aura:THREE.Mesh;
  private readonly trail=new Trail();private readonly ribbon:Ribbon;private readonly superTrail:Ribbon;
  /** The effects' clock (s): it stands still while the ball's time is stopped. */
  private readonly time={value:0};
  private readonly fx=new InkFx(this.time);
  private mode:BallModeId|null=null;private startedAt=NaN;private lastServer=-Infinity;
  /** The last two balls the room sent, the server time each came under and the page time (s) each arrived. */
  private readonly base=blankBall();private readonly prev=blankBall();private readonly sim=blankBall();
  private baseServer=-1;private prevServer=-1;private baseAt=0;private lastRef:BallState|null=null;
  /** The frame's segment (CombatTimeline: view.next): the next snapshot's ball, when, and how far the base's own flight
   *  misses it there - blended in across the segment, so the drawn ball meets every snapshot on time. */
  private nextRef:BallState|null=null;private nextAt=-1;private readonly miss=new THREE.Vector3();
  private readonly drawn=new THREE.Vector3();private readonly offset=new THREE.Vector3();private readonly velocity=new THREE.Vector3();
  private shown=false;private lastEvent=-1;private frozen=false;private freezeFrom=0;private freezeLength=1;
  // ─── The page's own touch, drawn at once (online) ──────────────────────────────────────────────────────────────
  /** The room's balls as the snapshots brought them (`heard`: online the newest is a round trip and more ahead of the
   *  frame drawn), oldest first, and the newest's time. */
  private readonly ring:{t:number;ball:BallState;live:boolean;hold:number}[]=[];
  /** The page's view lag (s: its prediction's clock less the frame's, what the room measures as this page's lag; main.ts
   *  sets it every frame online, 0 elsewhere), and an attack the room put back into this page's time (`rewound`). */
  viewLag=0;
  private rewind:{tr:number;lag:number;upTo:number}|null=null;
  /** The page's own touch, forecast (game/ball/BallTargets) and not yet heard back from the room: the ball as it left,
   *  the presented time it left at, the lead the ball was drawn with then, and the page clock (s) it was made at. */
  private ahead:{ball:BallState;at:number;room:number;lead:number;kind:string;made:number}|null=null;
  /** How far ahead of the frame the ball is drawn (s). 0, as every other body is drawn; after the page's own touch the
   *  room plays the ball in this page's time (BallMatch SEEN: `frame`), so it is drawn there - where the page's own
   *  fighter is - and eased back to the frame's time before anybody else meets it. */
  private lead=0;private leadRate=0;
  /** What is left to blend out of a forecast the room has answered (m), when it was set (page s) and over how long. */
  private readonly mend=new THREE.Vector3();private readonly mendV=new THREE.Vector3();private mendAt=0;private mendFor=MEND;
  private readonly mendX=new THREE.Vector3();private readonly mendU=new THREE.Vector3();
  /** The presented time of the last frame drawn (what `drawnState` is the ball at), the ring's newest drawn from then,
   *  the page's own id, and the round trip the page's touches have come back in (s, smoothed; 0 before the first). */
  private drawnT=NaN;private drawnAt=0;private ringSeen=-Infinity;private self='';private heardIn=0;
  /** The ball whose look is drawn: the snapshot's, the forecast's, or the room's ahead of the frame. */
  private readonly ahead0=blankBall();private readonly look0=blankBall();private readonly tmp=blankBall();private readonly tmp2=blankBall();private readonly prior=blankBall();
  private readonly gap=new THREE.Vector3();
  private told:{kind:string;at:number;perfect:boolean}|null=null;private nearest=NaN;private landAt=0;private ringOf=NaN;private lastView:BallView|null=null;
  /** For the checks (window.__ballField on this machine): each forecast and what the room made of it. */
  readonly forecasts:{kind:string;lead:number;miss:number;missV:number;refused:boolean;heardIn:number;late:number}[]=[];
  private readonly charms=new BallCharms();
  private heat=0;private flash=0;private grown=1;private trailClock=0;private pulseAt=0;
  private embers=0;private sparks=0;private bolts=0;private streaks=0;private smoke=0;
  private readonly land={x:0,z:0,t:0,show:false,team:null as BallTeam|null};
  private readonly contacts:BallContact[]=[];
  private readonly eye=new THREE.Vector3();private readonly omega=new THREE.Vector3();private readonly axis=new THREE.Vector3();private readonly turn=new THREE.Quaternion();
  private readonly tint=new THREE.Color();
  /** The shared effects kit, for its pooled lights (vfx/LightPool). */
  private readonly kit:VfxKit;
  // ─── Marks from the drawn effects, a pitch that remembers, a ball with character ─────────────────────
  /** The floor's marks (vfx/GroundMarks: a skid, a scorch, a goal's stamp, a kill's dent): this field's own pool, on the
   *  page's clock (a replay rewinds the room's), the page time the last of them is gone by, and whether the frame drawn
   *  is a replay's (which lays none: its moments left theirs the first time). */
  private readonly marks:GroundMarks;private marksUntil=0;private page=0;private replaying=false;
  /** Where each seat's body was drawn a frame ago and how fast it moves along the floor (m/s), for the skids' lie; the
   *  page time each last left one. */
  private readonly bodies=new Map<string,{x:number;z:number;vx:number;vz:number;skid:number}>();
  /** The ball's shape: flattened along `shapeAxis` by a blow (`press`: when, how hard), lengthened along its flight at
   *  speed; `length` is its scale down that axis now (its volume is kept across it). */
  private readonly shaper=new THREE.Group();private readonly unshaper=new THREE.Group();
  private readonly shapeAxis=new THREE.Vector3(0,1,0);private readonly pressAxis=new THREE.Vector3(0,1,0);private pressAt=-Infinity;private pressBy=0;private length=1;
  /** The lines that show its turn: a shell round the ball, square to its spin, turned with it. */
  private readonly spinLines:THREE.Mesh<THREE.SphereGeometry,THREE.ShaderMaterial>;private spinTurn=0;private spinShown=0;
  /** A power shot's path, left hanging as a brush stroke: its own trail and ribbon, the seconds it is still being
   *  drawn for, and its colour. */
  private readonly strokeTrail=new Trail();private readonly stroke:Ribbon;private strokeLeft=0;private readonly strokeColour=new THREE.Color();
  /** How far the ball has thinned to its outline where it crosses the lens (0..1). */
  private thin=0;
  private readonly deep=new THREE.Color();private readonly edge=new THREE.Color();
  /** For the checks (window.__ballField on this machine): the ball's width over the frame's height, how far it has
   *  thinned, its scale along its shape's axis, how much of its spin lines show, and the floor's marks laid so far. */
  readonly look={share:0,thin:0,along:1,spin:0,marks:0};
  /** Where a fighter is drawn (main.ts hands it the drawn bodies), for the rings and tags under and over them; without
   *  it, where the snapshot puts them. */
  bodyOf:(id:string)=>THREE.Vector3|undefined=()=>undefined;
  private readonly tags=new BallTags();
  /** Football: the team-mate a PASS from your feet would go to now (main.ts, from footballPage.ts
   *  PassMark.pick; '' none) - the one body named on the football rules. */
  namedMate='';
  private readonly footTag=(seat:BallSeat)=>!!this.namedMate&&seat.id===this.namedMate&&seat.id!==this.self;
  /** The POWER PLAY's glowing goal and the marks of a TACKLE that won the ball and a REVERSAL. */
  private readonly fight:FightMarks;
  /** The page's own charged shot's aim line on the pitch (aimLine.ts); `aim` is what it
   *  shows, for the checks (window.__ballField on this machine). */
  private readonly aimLine=new AimLine();
  get aim(){return this.aimLine.look;}
  /** The carry drawn (CARRY_DRAW): whose, their side, the way the ball sits round their drawn body (rad),
   *  where that body was drawn a frame ago and how it runs (m/s, smoothed), how far the ball has come onto its feet (0..1)
   *  from where it was drawn as the carry began (`o`: off the feet then), and the ball as drawn, place and pace. Null while
   *  nobody carries it. */
  private carried:{id:string;team:BallTeam|null;heading:number;bx:number;bz:number;vx:number;vz:number;k:number;ox:number;oy:number;oz:number;over:number;x:number;z:number;ux:number;uz:number}|null=null;
  private readonly carryBody=new THREE.Vector3();
  /** For the checks (window.__ballField on this machine): the seat whose carried ball is drawn at its feet ('' none), and
   *  how far onto them it has come (0..1). */
  readonly carryLook={id:'',k:0};
  /** The page's own stick as its prediction steps it (main.ts: the command's world moveX/moveZ), for its own carried ball:
   *  the room turns a carried ball toward its carrier's stick (BallMatch CARRY), so the page turns its own the same way,
   *  in its own time. Unset, along the drawn body's run. */
  ownStick:()=>{moveX:number;moveZ:number}|undefined=()=>undefined;
  private players:GameSnapshot['players']=[];
  /** The ball gear (ballCosmetics.ts): your ball skin, the striker's trail, the scorer's goal burst. */
  private readonly gear=new BallGear();
  private readonly emit:Emit=(kind,x,y,z,vx,vy,vz,life,size0,size1,colour,alpha,how)=>{
    const o=this.fx.spawn(K[kind],x,y,z,vx,vy,vz,life,size0,size1,colour,alpha),d=this.fx.data;
    if(!how)return;
    d[o+DRAG]=how.drag??0;d[o+GRAV]=how.grav??0;d[o+SPIN]=how.spin??0;d[o+STRETCH]=how.stretch??0;
    d[o+FLAGS]=(how.flutter?FLUTTER:0)|(how.floor?FLOOR:0)|(how.along?ALONG_FLIGHT:0)|(how.axis?ALONG_AXIS:0);
    if(how.axis){d[o+AX]=how.axis[0];d[o+AY]=how.axis[1];d[o+AZ]=how.axis[2];}
  };

  constructor(scene:THREE.Scene){
    this.kit=VfxKit.for(scene);
    this.marks=new GroundMarks(scene,MARKS.most.high);this.marks.mesh.name='Ball modes · the pitch\'s marks';this.marks.mesh.visible=false;
    this.root.name='Ball modes · the ball and its moments';this.root.visible=false;scene.add(this.root);this.root.add(this.charms.root);
    this.fight=new FightMarks(this.root);this.fight.toward=id=>this.where(id,this.spot)??undefined;
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
      uniforms:{uKind:{value:0},uHeat:{value:0},uFreeze:{value:0},uSuper:{value:0},uFlash:{value:0},uThin:{value:0},uTime:this.time,uTeam:{value:new THREE.Color()},
        uPent:{value:ico},uHexa:{value:dodeca},uAxis:{value:axes},uTan:{value:tangents}},
      vertexShader:`varying vec3 vObj;varying vec3 vN;varying vec3 vV;
        void main(){vObj=position;vN=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.);vV=-mv.xyz;gl_Position=projectionMatrix*mv;}`,
      fragmentShader:`uniform float uKind,uHeat,uFreeze,uSuper,uFlash,uThin,uTime;uniform vec3 uTeam;
        uniform vec3 uPent[12];uniform vec3 uHexa[20];uniform vec3 uAxis[6];uniform vec3 uTan[6];
        varying vec3 vObj;varying vec3 vN;varying vec3 vV;
        vec3 heatColour(float h){
          vec3 c=mix(vec3(1.,.62,.28),vec3(1.,.4,.06),clamp(h-1.,0.,1.));
          c=mix(c,vec3(1.,.1,.03),clamp(h-2.,0.,1.));
          return mix(c,vec3(.72,.3,1.),clamp(h-3.,0.,1.));
        }
        void main(){
          vec3 n=normalize(vObj),base;float glow=0.;
          if(uKind>1.5){
            // VOLLEYBALL's ball: three strips on each of a cube's six faces (an eighteen-panel ball), the faces'
            // strips square to their neighbours', white, blue and yellow, ink at the seams - it reads on the orange
            // court, a blue crowd and a sunset sky alike.
            vec3 a=abs(n);float t,hi,mid,k;
            if(a.x>=a.y&&a.x>=a.z){t=n.y/a.x;hi=a.x;mid=max(a.y,a.z);k=0.;}
            else if(a.y>=a.z){t=n.z/a.y;hi=a.y;mid=max(a.x,a.z);k=1.;}
            else{t=n.x/a.z;hi=a.z;mid=max(a.x,a.y);k=2.;}
            float s=clamp(t*1.5+1.5,0.,2.999),strip=floor(s),line=abs(fract(s)-.5)*2.;
            vec3 W=vec3(.9,.89,.86),B=vec3(.08,.27,.78),Y=vec3(.98,.74,.1);
            vec3 outer=k<.5?W:k<1.5?Y:B,inner=k<.5?B:k<1.5?W:W;
            base=abs(strip-1.)<.5?inner:outer;
            float seam=max((1.-smoothstep(.015,.04,hi-mid)),smoothstep(.9,.97,line)*step(.2,s)*step(s,2.8));
            base=mix(base,vec3(.015),seam*.9);glow=seam;
          }
          else if(uKind<.5){
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
          // Heat (from tier two the burning skin and the fire in front of it hid the ball, and at three it read
          // as a pink blob): the ball stays ink and paper at every heat. Its pale panels take a warm cast, its black ones
          // stay black, and the heat is in its seams (or the weave's holes), glowing from two, crackling violet and white
          // at OVERDRIVE, and in a thin hot rim inside its ink outline. The fire is round it (the aura), never over it.
          float h=uHeat;vec3 hc=heatColour(h);
          // (Every term here stays under the frame's bloom: a glowing ball spreads its glow over its own panels.)
          c=mix(c,c*mix(vec3(1.),hc*1.1,.5),smoothstep(.6,2.2,h)*.35);
          c+=hc*glow*smoothstep(1.4,2.4,h)*.85;
          c+=vec3(.75,.6,1.2)*glow*smoothstep(3.7,4.2,h)*(.55+.45*sin(uTime*31.+vObj.y*9.));
          c+=hc*rim*smoothstep(.8,3.,h)*.45;
          c+=uTeam*rim*uSuper*(1.2+.6*sin(uTime*14.));
          c=mix(c,vec3(3.),uFlash*.7);
          float grey=dot(c,vec3(.3,.59,.11));
          c=mix(c,vec3(1.-min(grey,1.)*.92),uFreeze);
          // Where the ball crosses the lens and would cover the play it thins to its outline (uThin): only
          // its limb is left, inside the ink hull's line, and the fighters behind it are read through its face.
          gl_FragColor=vec4(c,mix(1.,smoothstep(.5,.85,1.-facing),uThin));
        }`,
    });
    patchBallSkin(this.bodyMaterial);
    const body=this.bodyMesh=new THREE.Mesh(this.sphere,this.bodyMaterial),outline=this.outline;
    body.name='Ball';outline.name='Ball ink outline';outline.scale.setScalar(1.075);outline.renderOrder=-1;this.spinner.add(body,outline);
    this.halo.name='Ball halo (football)';this.halo.renderOrder=-2;this.halo.visible=false;this.spinner.add(this.halo);
    // The ball's shape is a stretch along one axis of the world, whatever way the ball has turned: the
    // shaper turns that axis onto its own up and scales, the unshaper turns back, the spinner spins inside them.
    this.unshaper.add(this.spinner);this.shaper.add(this.unshaper);
    // Its spin, drawn: three bands of tapered dashes on a shell just off the ball, square to the spin's axis and
    // turning with it - a paper line on an ink edge, thick at its head, so the way it turns is read at a glance.
    this.spinLines=new THREE.Mesh(this.sphere,new THREE.ShaderMaterial({
      name:'Ball spin lines',...PREMULTIPLIED,toneMapped:false,uniforms:{uTurn:{value:0},uAmount:{value:0}},
      vertexShader:`varying vec3 vObj;void main(){vObj=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader:`uniform float uTurn,uAmount;varying vec3 vObj;
        void main(){
          vec3 n=normalize(vObj);float lon=atan(n.z,n.x)*.15915494-uTurn,line=0.,ink=0.,px=fwidth(n.y)+.003;
          for(int k=0;k<3;k++){
            float fk=float(k),u=fract(lon*(k==1?2.:1.)+fk*.37),body=smoothstep(0.,.34,u)*(1.-smoothstep(.38,.42,u));
            float d=abs(n.y-(fk-1.)*.52),w=.05*body;
            line=max(line,(1.-smoothstep(w-px,w+px,d))*step(.02,body));ink=max(ink,(1.-smoothstep(w+.035-px,w+.035+px,d))*step(.02,body));
          }
          gl_FragColor=vec4(vec3(.96,.95,.9)*line*uAmount,max(line,ink*.8)*uAmount);
        }`,
    }));
    this.spinLines.name='Ball spin lines';this.spinLines.scale.setScalar(1.2);this.spinLines.renderOrder=8;this.spinLines.visible=false;
    this.auraMaterial=new THREE.ShaderMaterial({
      name:'Ball heat aura',...PREMULTIPLIED,toneMapped:false,
      uniforms:{uHeat:{value:0},uTime:this.time,uSuper:{value:0},uFreeze:{value:0},uR:{value:.4},uSize:{value:1},uLift:{value:.6},uVel:{value:new THREE.Vector3()},uTeam:{value:new THREE.Color()},uNoise:{value:noiseTexture()},uGlow:{value:1}},
      vertexShader:`uniform float uSize,uLift;uniform vec3 uVel;varying vec2 vP;varying vec2 vDir;varying float vSpeed;
        void main(){
          vP=position.xy;
          vec4 c=modelViewMatrix*vec4(0.,0.,0.,1.);
          vec3 d=(viewMatrix*vec4(uVel,0.)).xyz;float s=length(d.xy);vDir=s>.01?d.xy/s:vec2(0.,1.);vSpeed=s;
          // Drawn just in front of the ball, so its flames wrap the ball's silhouette.
          c.xyz+=normalize(-c.xyz)*uLift;c.xy+=position.xy*uSize;
          gl_Position=projectionMatrix*c;
        }`,
      fragmentShader:`uniform float uHeat,uTime,uSuper,uFreeze,uR,uGlow;uniform vec3 uTeam;uniform sampler2D uNoise;
        varying vec2 vP;varying vec2 vDir;varying float vSpeed;
        float h1(float n){return fract(sin(n)*43758.5453);}
        void main(){
          vec2 p=vP;float r=length(p),ang=atan(p.y,p.x),h=uHeat;
          float tail=max(dot(p/max(r,1e-4),-vDir),0.),stretch=clamp(vSpeed/28.,0.,1.);
          float n=texture2D(uNoise,vec2(ang*.32+uTime*.05,r*.9-uTime*1.7)).g,n2=texture2D(uNoise,vec2(ang*.95-uTime*.11,r*2.1-uTime*3.)).b;
          // Flames lick out past the ball and stream back along its flight, longer the hotter and faster it goes.
          float reach=uR*(1.12+h*.1)+tail*tail*stretch*(.25+h*.07)+(n*.65+n2*.35-.5)*(.16+h*.05);
          // Outside the ball's ink outline only (the plane stands a little in front of the ball, so uR is a shade over the
          // ball's own drawn size): the fire wraps the ball and never covers its face.
          float flame=1.-smoothstep(reach-.06,reach+.02,r),outside=smoothstep(uR*1.04,uR*1.14,r);
          vec3 rgb=vec3(0.);float cover=0.;
          // One: a warm halo.
          rgb+=vec3(1.,.55,.2)*exp(-max(r-uR,0.)*7.)*outside*smoothstep(.6,1.2,h)*(1.-smoothstep(2.,2.6,h))*.8;
          // Two and up: fire, yellow to orange at two, red at three, violet at four.
          // (Kept near the bloom's threshold: hotter, its glow spread over the ball and washed it out.)
          vec3 core=mix(vec3(1.45,1.1,.45),vec3(1.55,.6,.16),smoothstep(1.,2.5,h));core=mix(core,vec3(1.55,.3,.12),smoothstep(2.5,3.2,h));core=mix(core,vec3(1.05,.5,1.75),smoothstep(3.4,3.9,h));
          vec3 tip=mix(vec3(1.1,.25,.04),vec3(.85,.05,.03),smoothstep(2.5,3.2,h));tip=mix(tip,vec3(.45,.12,1.1),smoothstep(3.4,3.9,h));
          float k=clamp((r-uR*.9)/max(reach-uR*.9,.01),0.,1.);
          rgb+=mix(core,tip,k)*flame*outside*smoothstep(1.6,2.2,h);
          // Three: black ink smoke at the flame's tips and rings of heat shimmer round it.
          float smoke=smoothstep(reach-.14,reach-.02,r)*flame*outside*smoothstep(2.6,3.1,h)*(1.-smoothstep(3.4,3.9,h));
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
            rgb+=vec3(1.1,.95,1.6)*bolts*over+vec3(1.1,.9,1.6)*exp(-max(r-uR,0.)*14.)*outside*over*.7;
          }
          // The heat tier, counted in rings round the ball (one a tier, dashed and turning, each in its tier's colour on an
          // ink edge), so a glance tells how hot it is however small it is on screen.
          float tier=floor(h+.001),px=max(fwidth(r),1e-4);
          for(int i=0;i<4;i++){
            float fi=float(i);if(fi>=tier)break;
            float rr=uR*(1.62+fi*.2),d=abs(r-rr),w=max(uR*.05,px*1.1);
            float turn=ang*.15915494*(9.+fi*3.)+uTime*(.22+fi*.07)*(mod(fi,2.)*2.-1.);
            float dash=smoothstep(.2,.28,fract(turn))*(1.-smoothstep(.78,.86,fract(turn)));
            float edge=(1.-smoothstep(w*1.9,w*1.9+px,d))*dash,line=(1.-smoothstep(w,w+px,d))*dash;
            vec3 tc=fi<.5?vec3(1.,.74,.3):fi<1.5?vec3(1.,.45,.12):fi<2.5?vec3(1.,.16,.07):vec3(.75,.42,1.);
            rgb=rgb*(1.-edge*.85)+tc*line;cover=max(cover,edge*.85);
          }
          // A super shot: a pulsing ring and glow in the striker's colour.
          float pulse=.5+.5*sin(uTime*13.);
          rgb+=uTeam*((1.-smoothstep(.03,.09,abs(r-uR*(1.55+.12*pulse))))*2.4+exp(-max(r-uR,0.)*5.)*outside*.9)*uSuper*(1.+pulse*.5);
          rgb*=(1.-smoothstep(.9,1.,r))*uGlow;
          rgb=mix(rgb,vec3(dot(rgb,vec3(.3,.59,.11))*.8),uFreeze);
          gl_FragColor=vec4(rgb,cover);
        }`,
    });
    this.aura=new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.auraMaterial);this.aura.name='Ball heat aura';this.aura.frustumCulled=false;this.aura.renderOrder=11;this.aura.visible=false;
    // (The spin lines take the ball's shape with it, so a stretched ball never pokes through its own shell.)
    this.unshaper.add(this.spinLines);this.ball.add(this.shaper,this.aura);this.ball.name='Ball';
    const ribbon=(style:number)=>new THREE.ShaderMaterial({
      name:style?'Ball super trail':'Ball trail',...PREMULTIPLIED,side:THREE.DoubleSide,toneMapped:false,
      uniforms:{uStyle:{value:style},uHeat:{value:0},uTime:this.time,uNoise:{value:noiseTexture()}},
      vertexShader:`attribute vec4 aColor;varying vec4 vColor;varying vec2 vUv;varying float vDepth;varying vec3 vAt;void main(){vColor=aColor;vUv=uv;vAt=position;vec4 mv=modelViewMatrix*vec4(position,1.);vDepth=-mv.z;gl_Position=projectionMatrix*mv;}`,
      fragmentShader:`uniform float uStyle,uHeat,uTime;uniform sampler2D uNoise;varying vec4 vColor;varying vec2 vUv;varying float vDepth;varying vec3 vAt;
        void main(){
          // (Faded out where it passes the lens, which a ball flown past the camera drew as a band across the frame.)
          float across=abs(vUv.y*2.-1.),a=vColor.a*smoothstep(1.,3.5,vDepth);
          if(uStyle<.5){
            // A solid band in the striker's colour, an ink edge, a white-hot core as the ball heats.
            float body=1.-smoothstep(.9,1.,across),ink=smoothstep(.72,.8,across)*body,core=1.-smoothstep(0.,.18+uHeat*.08,across);
            vec3 c=mix(vColor.rgb*1.35,vec3(2.4,2.3,2.2),core*(.25+uHeat*.15));
            c=mix(c,vColor.rgb*.12,ink*.85);
            float A=body*a;gl_FragColor=vec4(c*A,A);
          }else if(uStyle<1.5){
            // The super shot's mantle: flames licking off a band three times as wide, added light.
            float n=texture2D(uNoise,vec2(vUv.x*2.5-uTime*1.6,vUv.y*.7+uTime*.3)).g;
            float flame=1.-smoothstep(.35+n*.55,.5+n*.6,across);
            gl_FragColor=vec4((vColor.rgb*2.2+vec3(.6)*(1.-across))*flame*a,0.);
          }else{
            // A power shot's path left hanging: a dry brush's stroke in the striker's colour, ink at its
            // edges, ragged along them and broken where the brush ran dry. (Its grain is the world's, by where the
            // stroke lies, so it stands still as the stroke grows and fades.)
            float run=dot(vAt,vec3(.37,.21,.31)),n=texture2D(uNoise,vec2(run*.9,vUv.y*.6)).r,dry=texture2D(uNoise,vec2(run*.35,vUv.y*2.4+.3)).g;
            float body=1.-smoothstep(.62+n*.3,.74+n*.3,across),ink=smoothstep(.3+n*.2,.5+n*.2,across)*body;
            float A=body*smoothstep(.22,.42,dry+(1.-across)*.25)*a*.92;
            gl_FragColor=vec4(mix(vColor.rgb*1.2,vColor.rgb*.1,ink*.9)*A,A);
          }
        }`,
    });
    this.ribbon=new Ribbon(ribbon(0),'Ball trail');this.superTrail=new Ribbon(ribbon(1),'Ball super trail');this.superTrail.mesh.visible=false;
    this.stroke=new Ribbon(ribbon(2),'Ball shot stroke');this.stroke.mesh.renderOrder=8;this.stroke.mesh.visible=false;
    this.root.add(this.ball,this.stroke.mesh,this.ribbon.mesh,this.superTrail.mesh,this.fx.mesh,this.tags.mesh,this.aimLine.mesh);
  }

  /** Where the ball is drawn now - smoothed and run on from its snapshot - or null when no ball is up. The vector is
   *  this field's own and changes every frame: copy it to keep it. */
  ballPosition():THREE.Vector3|null{return this.shown?this.drawn:null;}

  /** Every frame. `now` is the page's clock in milliseconds (performance.now(), as main.ts passes it); `dt` the frame's
   *  seconds. Hides everything when the snapshot carries no ball. */
  update(snapshot:GameSnapshot|null|undefined,selfId:string,camera:THREE.Camera,dt:number,now:number,replaying=false){
    const view=ballOf(snapshot);
    if(!view||!snapshot){if(this.root.visible||this.shown)this.clear();return;}
    const seconds=now/1000,step=Math.min(Math.max(dt,0),.1),serverTime=snapshot.serverTime;
    this.page=seconds;this.replaying=replaying;
    if(view.mode!==this.mode||view.startedAt!==this.startedAt||serverTime<this.lastServer-.5)this.restart(view);
    this.lastServer=serverTime;this.root.visible=true;this.self=selfId;this.players=snapshot.players;this.lastView=view;
    this.receive(view.ball,view.sampledAt??serverTime,seconds,view.sampledAt!==undefined);
    this.place(serverTime,seconds,view,replaying?0:step);
    this.carry(view,seconds,step);
    this.moments(view,serverTime,seconds);
    this.dress(view,selfId,camera,step,seconds,serverTime);
    this.aimLine.update(view,selfId,this.drawnState(),this.bodies.get(selfId),step,!replaying);
    // The name tags: in play, not over a replay (its tag names the goal) nor the results.
    // (On the volleyball rules no body is named - less on screen.)
    // (Football: no rival is named and neither are you - your own mark is the arrow over you - and a
    // team-mate only while the ball is at your feet and a PASS would go to them (main.ts: footballPage.ts PassMark.pick),
    // small.)
    this.tags.update(view.seats,selfId,this.where,!replaying&&view.phase!=='lobby'&&view.phase!=='over',view.volley?noTag:view.football?this.footTag:undefined,view.football?FOOT_TAG:1);
    this.charms.update(view,snapshot.players,this.shown?this.drawn:null,step,serverTime);
    this.fight.update(view,replaying?0:step,seconds);
    // FEVER (Sky Spike) and OVERTIME (Goal Rush): the place at its peak while they last, the crowd on its feet.
    // (Goal Rush's FINAL PUSH too - its `fever`.)
    const peak=(view.mode==='sky-spike'?view.fever:view.overtime||view.fever)&&view.phase!=='over'?view.volley?VOLLEY_FX.mood:1:0;
    arenaMood.value+=(peak-arenaMood.value)*Math.min(1,step*2.5);
    crowdHype.value=Math.max(arenaMood.value*.45,crowdHype.value-step*.3);
  }

  /** Lets everything go: the ball hidden, every effect and the trail gone, the snapshots forgotten. */
  clear(){this.letGo();this.wipe();}
  /** The floor's marks gone: a match's, kept through its replays and let go with it. */
  private wipe(){this.marks.clear();this.marks.mesh.visible=false;this.marksUntil=0;}
  private letGo(){
    this.root.visible=false;this.shown=false;this.fx.clear();this.charms.clear();crowdHype.value=0;arenaMood.value=0;this.trail.count=0;this.ribbon.clear();this.superTrail.clear();
    this.mode=null;this.startedAt=NaN;this.lastServer=-Infinity;this.baseServer=-1;this.prevServer=-1;this.lastRef=null;this.nextRef=null;this.nextAt=-1;this.lastEvent=-1;
    this.offset.set(0,0,0);this.velocity.set(0,0,0);this.land.show=false;this.frozen=false;this.heat=0;this.flash=0;
    this.ring.length=0;this.ahead=null;this.lead=0;this.rewind=null;this.mend.set(0,0,0);this.mendV.set(0,0,0);this.drawnT=NaN;this.ringSeen=-Infinity;this.told=null;
    this.strokeTrail.count=0;this.stroke.clear();this.stroke.mesh.visible=false;this.strokeLeft=0;this.bodies.clear();this.marks.mesh.visible=false;
    this.pressAt=-Infinity;this.length=1;this.thin=0;this.spinShown=0;this.spinLines.visible=false;this.aimLine.hide();
    this.carried=null;this.carryLook.id='';this.carryLook.k=0;this.fight.clear();
  }

  // ─── The page's own touch, drawn at once ─────────────────────────────────────────────────────────────────────────
  /** Every snapshot the page hears, as it hears it (main.ts onSnapshot): the room's ball, kept a little over a second.
   *  Online it runs a round trip and more ahead of the frame drawn; the ball drawn ahead of the frame (`lead`) and the
   *  room's word on a forecast touch are read from it. */
  heard(snapshot:GameSnapshot){
    const view=ballOf(snapshot);if(!view)return;
    const t=snapshot.serverTime,R=this.ring,last=R[R.length-1];
    if(last&&(t<last.t-.5||view.startedAt!==this.ringOf)){R.length=0;this.ahead=null;this.lead=0;this.rewind=null;}
    this.ringOf=view.startedAt;
    if(last&&t<=last.t+1e-6)return;
    const live=view.phase==='live'||view.phase==='kickoff'&&view.mode==='sky-spike';
    const old=R.length>=48&&R[0].t<t-RING?R.shift()!:null,ball=old?copyBall(old.ball,view.ball):copyBall(blankBall(),view.ball);
    const prev=R[R.length-1];
    // (A ball still held where the room put it back, standing as it was: held as long.)
    const hold=prev&&prev.hold>t&&Math.abs(prev.ball.x-ball.x)+Math.abs(prev.ball.y-ball.y)+Math.abs(prev.ball.z-ball.z)<1e-3?prev.hold:-Infinity;
    R.push({t,ball,live,hold});
    while(R.length>2&&R[1].t<t-RING)R.shift();
    if(prev&&hold===-Infinity&&live)this.rewound(prev,R[R.length-1]);
  }

  /** The other side's attack, put back by the room into this page's time as it came at this page's fighter (BallMatch
   *  SEEN `meetSeen`): the snapshot has the ball where the page drew it a moment ago - the room's own flight, earlier,
   *  no new touch - and, if the touch that sent it is newer than the page had seen, held there until the page would see
   *  it go. Drawn as it was, the ball hopped back, hung, and came again; and the page's own guard met it a lag late. So
   *  from the moment it was put back to, it is drawn ahead of the frame by the room's lag for this page (`rewind`):
   *  the flight the page was drawing goes on, and the guard meets it where the room does. */
  private rewound(prev:{t:number;ball:BallState},cur:{t:number;ball:BallState;hold:number}){
    const b=cur.ball,lag=this.viewLag;
    if(lag<1/30||this.ahead||b.held||b.lastId===this.self||b.lastId!==prev.ball.lastId||b.lastTeam!==prev.ball.lastTeam)return;
    const f=this.flyFrom(this.tmp,prev.ball,prev.t,cur.t);
    if(Math.abs(f.x-b.x)+Math.abs(f.y-b.y)+Math.abs(f.z-b.z)<.3)return;
    // (Where on the flight the page had drawn the ball is the room's ball now: the room's time it was there.)
    let best=NaN,bestD=Infinity;
    for(let back=1/60;back<=Math.min(.45,lag+.15);back+=1/60){
      if(!this.truth(cur.t-back,this.prior,prev.t))break;
      const p=this.prior,d=Math.hypot(p.x-b.x,p.y-b.y,p.z-b.z)+.05*Math.hypot(p.vx-b.vx,p.vy-b.vy,p.vz-b.vz);
      if(d<bestD){bestD=d;best=back;}
    }
    if(!(bestD<.25)||!this.headedAt(b))return;
    const tr=cur.t-best;
    cur.hold=tr+lag>cur.t?tr+lag:-Infinity;
    this.rewind={tr,lag,upTo:prev.t};
  }
  /** Whether a ball's flight comes to this page's own fighter before it comes to anybody else's (as they are drawn now),
   *  within LEAD_LOOK s. */
  private headedAt(ball:BallState){const m=this.meets(ball);return m.mine<Infinity&&m.mine<=m.other;}

  /** The page's own touch of the ball, forecast (game/ball/BallTargets, online): the ball is drawn leaving at once, from
   *  where it was drawn, along the flight the room will most likely give it, until the room's word comes back - then
   *  onto the room's (`ahead`). Its moment (a strike's hit, a block's shield) is drawn now, and the room's own for it is
   *  not drawn again. */
  forecastTouch(touch:TouchForecast){
    if(!this.shown||!this.mode||!Number.isFinite(this.drawnT))return;
    const seconds=this.drawnAt,ball=copyBall(blankBall(),touch.ball);
    // (From where the ball was drawn - as the room's history has it for this page's swing - with whatever of the last
    // answer was still being blended in, so nothing jumps: the new flight starts from the drawn ball itself.)
    ball.x=this.drawn.x;ball.y=this.drawn.y;ball.z=this.drawn.z;this.mend.set(0,0,0);this.mendV.set(0,0,0);
    this.ahead={ball,at:this.drawnT,room:touch.room??NaN,lead:this.lead,kind:touch.kind,made:seconds};
    this.landFrom(ball,seconds);
    const e=touch.event;
    if(e&&this.lastView){
      this.told={kind:e.kind,at:seconds,perfect:!!e.perfect};
      this.moment({id:-1,at:this.drawnT,...e,x:ball.x,y:ball.y,z:ball.z} as BallEvent,{...this.lastView,ball});
    }
  }

  /** The ball as the page draws it now, as a whole ball (the look of the one drawn, at the drawn place and pace): what the
   *  page's own touch is forecast from. Null when none is drawn. The ball is this field's own: copy it to keep it. */
  drawnState():BallState|null{
    if(!this.shown||!this.mode)return null;
    const b=copyBall(this.tmp2,this.lookBall());
    b.x=this.drawn.x;b.y=this.drawn.y;b.z=this.drawn.z;b.vx=this.velocity.x;b.vy=this.velocity.y;b.vz=this.velocity.z;
    return b;
  }

  /** The ball whose look is drawn: the forecast's while it flies, the room's ahead of the frame while it is drawn there,
   *  else the snapshot's. */
  private lookBall(){return this.ahead?this.ahead.ball:this.lead>0||this.rewind?this.look0:this.base;}
  /** What is left of the answers' misses at `seconds` (into mendX, its pace into mendU): a critically damped spring from
   *  where it was set (mend, mendV at mendAt), over `mendFor` - so the ball keeps its place and its pace at an answer
   *  and settles onto the room's flight, a small miss in a few frames, a refused touch (a whole flight's worth) slowed,
   *  turned and brought back rather than jumped or yanked. */
  private mendNow(seconds:number){
    const w=1/this.mendFor,age=Math.max(0,seconds-this.mendAt),e=Math.exp(-w*age);
    // x(t) = (x0 + (v0 + w x0) t) e^-wt; v(t) = (v0 - (v0 + w x0) w t) e^-wt
    this.mendU.copy(this.mendV).addScaledVector(this.mend,w);
    this.mendX.copy(this.mend).addScaledVector(this.mendU,age).multiplyScalar(e);
    this.mendU.multiplyScalar(-w*age).add(this.mendV).multiplyScalar(e);
    return this.mendX;
  }
  /** A new miss to blend out (place and pace, the drawn ball's less the ball it is drawn from now), on what is left of
   *  the last. Past three SNAPs it is a reset: drawn at once. */
  private mendBy(seconds:number,dx:number,dy:number,dz:number,dvx:number,dvy:number,dvz:number,over:number){
    if(dx*dx+dy*dy+dz*dz>(SNAP*3)**2){this.mend.set(0,0,0);this.mendV.set(0,0,0);return;}
    this.mendNow(seconds);
    this.mend.copy(this.mendX).add(this.gap.set(dx,dy,dz));this.mendV.copy(this.mendU).add(this.gap.set(dvx,dvy,dvz));
    this.mendAt=seconds;this.mendFor=over;
  }

  /** The room's ball at `tau` (server s), from the snapshots heard (with `upTo`: only those up to that time, as the last
   *  frame had them): the one before run on along its own flight, bent onto the one after across the gap - as `timed`
   *  draws the frame's - or run on past the newest. Into `out`; false when nothing is heard. */
  private truth(tau:number,out:BallState,upTo=Infinity){
    const R=this.ring;let n=R.length;while(n>0&&R[n-1].t>upTo+1e-9)n--;
    if(!n)return false;
    let i=n-1;while(i>0&&R[i].t>tau+1e-9)i--;
    const base=R[i],next=i+1<n?R[i+1]:null,span=next?next.t-base.t:0,s=next&&span>1e-4?Math.min(1,Math.max(0,(tau-base.t)/span)):0;
    if(base.ball.held||next?.ball.held&&s>0){
      const to=next?.ball??base.ball;copyBall(out,base.ball);
      out.x=base.ball.x+(to.x-base.ball.x)*s;out.y=base.ball.y+(to.y-base.ball.y)*s;out.z=base.ball.z+(to.z-base.ball.z)*s;out.vx=out.vy=out.vz=0;return true;
    }
    this.flyFrom(out,base.ball,base.t,tau,base.hold);
    if(next&&span>1e-4){
      const f=this.flyFrom(this.tmp,base.ball,base.t,next.t,base.hold),mx=next.ball.x-f.x,my=next.ball.y-f.y,mz=next.ball.z-f.z;
      if(mx*mx+my*my+mz*mz<=SNAP*SNAP){
        const w=s*s*(3-2*s),rate=6*s*(1-s)/span;
        out.x+=mx*w;out.y+=my*w;out.z+=mz*w;out.vx+=mx*rate;out.vy+=my*rate;out.vz+=mz*rate;
      }
    }
    return true;
  }
  /** `b` (sampled at `from`) run on along its own flight to `to` into `out`: it stands still while stopped or clashing. */
  private flyFrom(out:BallState,b:BallState,from:number,to:number,hold=-Infinity){
    const start=Math.max(from,b.frozenUntil,b.clash,hold),age=Math.min(.8,Math.max(0,to-start));
    copyBall(out,b);out.held=false;
    for(let left=age;left>1e-5;left-=1/60)stepBall(this.mode!,out,Math.min(1/60,left),this.contacts);
    if(to<b.frozenUntil||to<b.clash||to<hold){out.vx=out.vy=out.vz=0;}
    return out;
  }

  /** The frame's ball while the page's own touch is forecast or the ball is drawn ahead of the frame. The forecast flies
   *  on from where it left until the room's word on it comes back. Heard, the ball goes on along the room's own flight
   *  from the moment on it that lines up with where the forecast has it - so the ball keeps its pace and only the miss is
   *  blended out - which puts it `lead` ahead of the frame: the room plays the ball in this page's time after its touch
   *  (BallMatch SEEN). Refused, it goes back to the room's ball at the lead it had, the whole miss blended out more
   *  gently. Ahead of the frame, a snapshot that changes the room's flight there (somebody else's touch) is blended in,
   *  not jumped to, and the lead is eased off (`easeLead`) until the ball is in the frame's time again. */
  private drawAhead(t:number,seconds:number,view:BallView,dt:number){
    const a=this.ahead;
    if(a){
      this.nearest=NaN;const word=this.verdict(a),f=this.flyFrom(this.ahead0,a.ball,a.at,t);
      if(word===null){this.drawn.set(f.x,f.y,f.z);this.velocity.set(f.vx,f.vy,f.vz);return;}
      let lead=a.lead,miss=-1,missV=-1,late=NaN;
      if(word){
        const u=this.along(a,word),g=this.flyFrom(this.tmp,a.ball,a.at,a.at+u);
        lead=Math.max(0,Math.min(.5,word.t-a.at-u));
        miss=Math.hypot(g.x-word.ball.x,g.y-word.ball.y,g.z-word.ball.z);missV=Math.hypot(g.vx-word.ball.vx,g.vy-word.ball.vy,g.vz-word.ball.vz);
        this.heardIn=this.heardIn>0?this.heardIn+(lead-this.heardIn)*.3:lead;late=word.t-a.room;
      }
      this.ahead=null;this.lead=lead;this.leadRate=0;
      this.forecasts.push({kind:a.kind,lead:+lead.toFixed(3),miss:+miss.toFixed(3),missV:+missV.toFixed(2),refused:!word,heardIn:+(seconds-a.made).toFixed(3),late:+(word?late:this.nearest).toFixed(3)});
      if(this.forecasts.length>200)this.forecasts.shift();
      this.ringSeen=this.ring[this.ring.length-1]?.t??-Infinity;
      // (Where the forecast was drawn, against where the room's ball is drawn from now: blended out.)
      if(lead>0)this.truth(t+lead,this.look0);else this.timed(t,view);
      const to=lead>0?this.look0:this.drawn,vx=lead>0?this.look0.vx:this.velocity.x,vy=lead>0?this.look0.vy:this.velocity.y,vz=lead>0?this.look0.vz:this.velocity.z;
      this.mendBy(seconds,f.x-to.x,f.y-to.y,f.z-to.z,f.vx-vx,f.vy-vy,f.vz-vz,word?MEND:REFUSED);
      if(lead<=0)return;
      this.landFrom(this.look0,seconds);
    }
    if(this.lead<=0){this.timed(t,view);return;}
    const R=this.ring,newest=R[R.length-1]?.t??-Infinity,tau=t+this.lead;
    if(!this.truth(tau,this.look0)||this.look0.held){this.lead=0;this.timed(t,view);return;}
    if(newest>this.ringSeen&&Number.isFinite(this.ringSeen)&&this.truth(tau,this.prior,this.ringSeen)){
      // A snapshot heard since the last frame changed the room's flight this far ahead (somebody else's touch, a bounce
      // off a body): what it moved is blended in, not jumped to.
      const p=this.prior,l=this.look0,dx=p.x-l.x,dy=p.y-l.y,dz=p.z-l.z,d2=dx*dx+dy*dy+dz*dz;
      if(d2>1e-6){this.mendBy(seconds,dx,dy,dz,p.vx-l.vx,p.vy-l.vy,p.vz-l.vz,d2>.25?REFUSED:MEND);this.landFrom(l,seconds);}
    }
    this.ringSeen=newest;
    this.drawn.set(this.look0.x,this.look0.y,this.look0.z);this.velocity.set(this.look0.vx,this.look0.vy,this.look0.vz);
    this.easeLead(dt);
    if(this.lead<=0){
      // (Back in the frame's time: the frame's own ball from here, anything between the two blended out.)
      const x=this.drawn.x,y=this.drawn.y,z=this.drawn.z,vx=this.velocity.x,vy=this.velocity.y,vz=this.velocity.z;this.lead=0;this.timed(t,view);
      this.mendBy(seconds,x-this.drawn.x,y-this.drawn.y,z-this.drawn.z,vx-this.velocity.x,vy-this.velocity.y,vz-this.velocity.z,MEND);
      this.forecast();
    }
  }
  /** How far along the forecast's flight (s) the room's first ball after the touch lines up with it: the nearest it
   *  comes to that ball. */
  private along(a:{ball:BallState;at:number},word:{t:number;ball:BallState}){
    const b=copyBall(this.tmp,a.ball),w=word.ball,most=Math.min(.5,Math.max(0,word.t-a.at));b.held=false;
    let best=0,bestD=Math.hypot(b.x-w.x,b.y-w.y,b.z-w.z);
    for(let u=1/120;u<=most+1e-6;u+=1/120){
      stepBall(this.mode!,b,1/120,this.contacts);
      const d=Math.hypot(b.x-w.x,b.y-w.y,b.z-w.z);if(d<bestD){bestD=d;best=u;}
    }
    return best;
  }
  /** The lead eased off: at least LEAD_EASE.least of the frame's time, and fast enough (up to LEAD_EASE.most) to be gone
   *  before the ball's flight brings it to any other fighter (as they are drawn now), within LEAD_MEET; not at all while
   *  it is on its way to the page's own fighter first - there the room's time and this page's are the same. */
  private easeLead(dt:number){
    if(dt<=0)return;
    const {mine,other}=this.meets(this.look0);
    // (The rate itself eases, so the ball's pace changes over a few frames rather than in one.)
    const want=mine<other?0:Math.min(LEAD_EASE.most,Math.max(LEAD_EASE.least,this.lead/Math.max(.05,other-.1)));
    this.leadRate+=(want-this.leadRate)*Math.min(1,dt*LEAD_EASE.settle);
    this.lead=Math.max(0,this.lead-this.leadRate*dt);
  }

  /** When a ball's flight first comes within LEAD_MEET of this page's own fighter (coming to it, not leaving it) and of
   *  anybody else's (s, as they are drawn now; Infinity: not within LEAD_LOOK). */
  private readonly met={mine:Infinity,other:Infinity};
  private meets(ball:BallState){
    const b=copyBall(this.tmp,ball),me=this.where(this.self,this.spot),others=this.lastView?.seats??[],meet2=LEAD_MEET*LEAD_MEET;
    let other=Infinity,mine=Infinity,inside=true;b.held=false;
    for(let s=0;s<=LEAD_LOOK&&other===Infinity;s+=1/30){
      if(me&&mine===Infinity){const d2=(b.x-me.x)**2+(b.y-me.y-1)**2+(b.z-me.z)**2;if(d2>meet2)inside=false;else if(!inside||s===0)mine=s;}
      for(let i=0;i<others.length;i++){
        const id=others[i].id;if(id===this.self)continue;
        const q=this.where(id,this.direction);if(!q)continue;
        if((b.x-q.x)**2+(b.y-q.y-1)**2+(b.z-q.z)**2<meet2){other=s;break;}
      }
      stepBall(this.mode!,b,1/30,this.contacts);
    }
    this.met.mine=mine;this.met.other=other;return this.met;
  }

  /** The room's word on the forecast touch `a`, from the snapshots heard since it: the snapshot that has the ball changed
   *  by this page's fighter (its last toucher) nearest the forecast - the touch, heard - or false: refused, the point
   *  over, or nothing of this page's by a little past the room's time for it. Null: not heard yet. */
  private verdict(a:{ball:BallState;at:number;room:number}){
    // (From a little before the room's time for the touch - the page's prediction's clock as it struck, the time the room
    // plays the command at; the room can play a backlog of commands a few ticks sooner - else from the frame it was
    // forecast on. A touch of this page's further back is not this one: the ball the room had reached the body a round
    // trip before the swing did. Of those that are, the one that sends the ball most nearly as the forecast does.)
    const R=this.ring,known=Number.isFinite(a.room),from=known?a.room-HEARD_BACK:a.at,f0=a.ball,pace=Math.hypot(f0.vx,f0.vy,f0.vz);
    let best:typeof R[number]|null=null,bestD=Infinity;
    for(let i=1;i<R.length;i++){
      const prev=R[i-1],cur=R[i];if(cur.t<=from+1e-6)continue;
      if(!cur.live)return best??false;
      const f=this.flyFrom(this.tmp,prev.ball,prev.t,cur.t),b=cur.ball;
      const changed=f.held!==b.held||Math.abs(f.x-b.x)+Math.abs(f.y-b.y)+Math.abs(f.z-b.z)>.05||Math.abs(f.vx-b.vx)+Math.abs(f.vy-b.vy)+Math.abs(f.vz-b.vz)>.5;
      if(!changed||b.lastId!==this.self)continue;
      const d=Math.hypot(b.vx-f0.vx,b.vy-f0.vy,b.vz-f0.vz);
      if(d<bestD){best=cur;bestD=d;}
      if(d<3+pace*.3)return cur;
    }
    const newest=R[R.length-1]?.t??-Infinity;
    const out=newest>=(known?a.room+HEARD_PAST:a.at+(this.heardIn>0?Math.min(HEARD,this.heardIn+.12):HEARD))?best??false:null;
    // (For the log: a refused one's nearest touch of this page's in the room, from its time for the touch.)
    if(out===false)for(let i=1;i<R.length;i++){const cur=R[i];if(cur.t>a.at&&cur.ball.lastId===this.self&&!sameBall(cur.ball,R[i-1].ball)){this.nearest=cur.t-a.room;break;}}
    return out;
  }

  dispose(){
    this.clear();this.charms.dispose();this.tags.dispose();this.aimLine.dispose();this.root.removeFromParent();this.marks.dispose();
    this.sphere.dispose();this.aura.geometry.dispose();this.fx.mesh.geometry.dispose();this.ribbon.mesh.geometry.dispose();this.superTrail.mesh.geometry.dispose();this.stroke.mesh.geometry.dispose();
    for(const m of [this.haloMaterial,this.bodyMaterial,this.outlineMaterial,this.auraMaterial,this.fx.mesh.material,this.ribbon.mesh.material,this.superTrail.mesh.material,this.stroke.mesh.material,this.spinLines.material])m.dispose();
  }

  /** A new match, or a new mode: the ball at its size and in its make, nothing carried over. */
  private restart(view:BallView){
    // (A replay rewinds the room's clock in the same match: the floor keeps what the match has left on it.)
    const fresh=view.mode!==this.mode||view.startedAt!==this.startedAt;
    this.letGo();if(fresh)this.wipe();this.mode=view.mode;this.startedAt=view.startedAt;this.root.visible=true;
    this.ball.scale.setScalar(ballRadius(view.mode));this.bodyMaterial.uniforms.uKind.value=view.mode==='goal-rush'?0:view.volley?2:1;
  }

  /** A ball from the room, if it is a new one: kept with the one before it, the drawn ball's lead over it kept as a
   *  correction to blend out, its landing forecast, and any rebound it took read from its change of flight. */
  private receive(b:BallState,serverTime:number,seconds:number,timed=false){
    if(b===this.lastRef)return;this.lastRef=b;
    // A presented frame can carry the same ball under a later time: nothing new.
    if(this.baseServer>=0&&sameBall(b,this.base))return;
    const had=this.baseServer>=0;
    copyBall(this.prev,this.base);this.prevServer=this.baseServer;
    copyBall(this.base,b);this.baseServer=serverTime;this.baseAt=seconds;
    if(!this.ahead&&this.lead<=0)this.forecast();
    if(!had||!this.shown){this.offset.set(0,0,0);this.drawn.set(b.x,b.y,b.z);return;}
    const p=this.prev,jump=Math.hypot(b.x-p.x,b.y-p.y,b.z-p.z),flight=p.held?0:Math.hypot(p.vx,p.vy,p.vz)*Math.max(.05,serverTime-this.prevServer);
    if(jump>SNAP+flight*1.5){this.offset.set(0,0,0);this.drawn.set(b.x,b.y,b.z);this.trail.count=0;return;}
    this.offset.set(this.drawn.x-b.x,this.drawn.y-b.y,this.drawn.z-b.z);
    if(timed)this.offset.set(0,0,0);
    if(this.offset.lengthSq()>SNAP*SNAP)this.offset.set(0,0,0);
    this.rebounds();
  }

  /** The drawn ball at the frame's time. A frame from the timeline (view.sampledAt) knows when its ball was sampled
   *  and the next snapshot's: the ball is where its flight has carried it since, bent onto the next snapshot across
   *  the gap. A bare snapshot (a check's): run on by its age - the presented clock's when that runs on, else the
   *  page's since it arrived - plus what is left of the correction. */
  private place(serverTime:number,seconds:number,view:BallView,dt=0){
    const b=this.base,frozen=b.frozenUntil>serverTime;
    if(frozen&&!this.frozen){this.freezeFrom=serverTime;this.freezeLength=Math.max(.2,b.frozenUntil-serverTime);}
    this.frozen=frozen;
    if(view.sampledAt!==undefined){
      // The page's own touch, drawn from the moment it was forecast; and after it, the ball drawn ahead of the
      // frame (in this page's own time) until it is eased back. Anything the room said otherwise is blended out (`mend`).
      const rw=this.rewind;
      if(rw&&!this.ahead){
        // (An attack put back into this page's time: the flight the page was drawing, up to the moment it was put back
        // to; from there the room's, ahead of the frame by the room's lag for this page. A ball still drawn ahead of the
        // frame from the last touch - a rebound, the next attack a moment after - is blended onto it.)
        const was=this.lead>0&&this.truth(serverTime+this.lead,this.prior);this.lead=0;
        if(serverTime<rw.tr&&this.truth(serverTime,this.look0,rw.upTo)){this.drawn.set(this.look0.x,this.look0.y,this.look0.z);this.velocity.set(this.look0.vx,this.look0.vy,this.look0.vz);}
        else{this.rewind=null;this.lead=rw.lag;this.leadRate=0;this.ringSeen=this.ring[this.ring.length-1]?.t??-Infinity;this.drawAhead(serverTime,seconds,view,dt);}
        const p=this.prior;
        if(was)this.mendBy(seconds,p.x-this.drawn.x,p.y-this.drawn.y,p.z-this.drawn.z,p.vx-this.velocity.x,p.vy-this.velocity.y,p.vz-this.velocity.z,MEND);
      }
      else if(this.ahead||this.lead>0)this.drawAhead(serverTime,seconds,view,dt);else this.timed(serverTime,view);
      if(this.mend.lengthSq()+this.mendV.lengthSq()>0){
        const x=this.mendNow(seconds);this.drawn.add(x);this.velocity.add(this.mendU);
        if(x.lengthSq()<1e-6&&this.mendU.lengthSq()<1e-4){this.mend.set(0,0,0);this.mendV.set(0,0,0);}
      }
      this.drawnT=serverTime;this.drawnAt=seconds;this.shown=true;return;
    }
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

  /** Goal Rush's carried ball (CARRY_DRAW), after the frame's ball is placed. Carried - by the ball the page
   *  draws from: the forecast's, the room's ahead of the frame, the frame's - it is drawn at its carrier's drawn feet as
   *  the room has it at theirs (carrySpot), the way it sits round them followed from where the room's flight has it (the
   *  frame's time, as every other body is drawn) or, for the page's own fighter drawn ahead of the room, turned along the
   *  drawn body's own run as the room turns it along the stick; it comes onto the feet over CARRY_DRAW.in from wherever
   *  it was drawn. Let go, the room's flight takes it from there, the place between the two blended out (the answers'
   *  spring) and the pace its own - a strike leaves at once - so nothing jumps either way. */
  private carry(view:BallView,seconds:number,dt:number){
    // (In the frame's own time the snapshot after the frame's says whether the carry lasts the gap between them: one that
    // ends in it is the room's flight's from the gap's start, its bend taking the ball off the feet as the room did.)
    const b=this.lookBall(),next=b===this.base?this.nextRef:null,lasts=!next||next.carry===b.carry;
    const id=view.mode==='goal-rush'&&!b.held&&!this.frozen&&lasts?b.carry:undefined,body=id?this.where(id,this.carryBody):null,r=ballRadius(view.mode)*this.grown;
    let c=this.carried;
    if(!id||!body){
      if(!c)return;
      this.carried=null;this.carryLook.id='';this.carryLook.k=0;
      // (Where the carried ball would be drawn now, against the room's: only the place is blended out.)
      const x=c.x+c.ux*dt,z=c.z+c.uz*dt,dx=x-this.drawn.x,dy=r-this.drawn.y,dz=z-this.drawn.z,miss=Math.hypot(dx,dy,dz);
      if(view.sampledAt!==undefined&&miss>1e-3&&miss<SNAP){this.mendBy(seconds,dx,dy,dz,0,0,0,miss>CARRY_DRAW.near?CARRY_DRAW.out:CARRY_DRAW.settle);this.drawn.set(x,r,z);}
      return;
    }
    let begun=false;
    if(!c||c.id!==id){
      // (Begun: the way it sits round the body from where it is drawn now - where it met them.)
      const hx=this.drawn.x-body.x,hz=this.drawn.z-body.z,seat=view.seats.find(s=>s.id===id);
      this.carried=c={id,team:seat?.team??null,heading:Math.hypot(hx,hz)>.2?Math.atan2(hx,hz):0,bx:body.x,bz:body.z,vx:0,vz:0,k:0,ox:0,oy:0,oz:0,over:CARRY_DRAW.in,x:this.drawn.x,z:this.drawn.z,ux:this.velocity.x,uz:this.velocity.z};
      begun=true;
    }
    if(dt>1e-4){
      const mx=(body.x-c.bx)/dt,mz=(body.z-c.bz)/dt,e=Math.min(1,dt*40);
      if(Math.abs(mx)+Math.abs(mz)<60){c.vx+=(mx-c.vx)*e;c.vz+=(mz-c.vz)*e;}
    }
    c.bx=body.x;c.bz=body.z;
    // The page's own fighter drawn ahead of the room (online): toward its own stick at the room's rate, as the room will
    // turn it (`ownStick`; else along its drawn run). Everyone else, and this device's own: as the room's flight has the
    // ball round them in the frame's time.
    const ahead=id===this.self&&this.viewLag>1/60;
    // (And the ball the room's flight draws is held in this page's own time meanwhile, the lead at the page's lag: what the
    // room makes of the ball next - the stick let go, a tackle - is drawn from its newest word, where this page's fighter
    // is, never a lag behind it; the lead is eased back as ever once the ball is gone from the feet.)
    if(ahead&&!this.ahead&&!this.rewind&&this.ring.length&&this.lead<this.viewLag){
      if(this.lead<=0)this.ringSeen=this.ring[this.ring.length-1].t;
      this.lead=this.viewLag;this.leadRate=0;
    }
    let want=c.heading,rate:number=CARRY_DRAW.follow;
    const stick=ahead?this.ownStick():undefined;
    if(stick){rate=CARRY.turn;if(Math.hypot(stick.moveX,stick.moveZ)>=CARRY.stick)want=Math.atan2(stick.moveX,stick.moveZ);}
    else if(ahead){rate=CARRY.turn*1.5;if(Math.hypot(c.vx,c.vz)>=CARRY_DRAW.run)want=Math.atan2(c.vx,c.vz);}
    else{const hx=this.drawn.x-body.x,hz=this.drawn.z-body.z;if(Math.hypot(hx,hz)>.3)want=Math.atan2(hx,hz);}
    // (Football - FOOT_CARRY: in front of the drawn body's own facing, as quick as it turns, so the ball is at the feet,
    // not beside the person - the room's carry turns at its own rate, the body at its own.)
    if(view.football){const face=this.facingOf(id);if(face!==undefined&&Number.isFinite(face)){want=face;rate=FOOT_CARRY.turn;}}
    const most=rate*dt;c.heading=wrapAngle(c.heading+Math.max(-most,Math.min(most,wrapAngle(want-c.heading))));
    // (Its place: the body's this frame - a drawn one is drawn after the ball, main.ts, so here a frame old: carried on by
    // its own run - and held inside the boards as the room's flight holds the ball, a goal's mouth open to its net.)
    const old=this.bodyOf(id)?dt:0,size=this.players.find(p=>p.id===id)?.size??1,spot=carrySpot({x:body.x+c.vx*old,z:body.z+c.vz*old,size},c.heading,r);
    // (SPORT mode, game/ball/football.ts: a sprint's knock-on, out ahead of the spot along the run.)
    {const ah=this.base.ahead??0;if(ah>0){spot.x+=Math.sin(c.heading)*ah;spot.z+=Math.cos(c.heading)*ah;}
      // (Football's dribble, drawn - FOOT_DRIBBLE.)
      else if(view.football){const d=this.dribble(id,body,c.heading,Math.hypot(c.vx,c.vz),Math.hypot(spot.x-body.x,spot.z-body.z),r,seconds,(this.base.wind??0)>0);spot.x+=Math.sin(c.heading)*d;spot.z+=Math.cos(c.heading)*d;}}
    {const R=GOAL_RULES,ix=R.halfX-r,iz=Math.abs(spot.x)<R.goalHalfWidth-r?R.halfZ+R.goalDepth-r:R.halfZ-r;spot.x=Math.max(-ix,Math.min(ix,spot.x));spot.z=Math.max(-iz,Math.min(iz,spot.z));}
    // (What lay between the ball as drawn and the feet as the carry began, let out over CARRY_DRAW.in: the feet carry it on
    // from there whatever the room's flight does meanwhile.)
    if(begun){c.ox=this.drawn.x-spot.x;c.oy=this.drawn.y-spot.y;c.oz=this.drawn.z-spot.z;c.over=Math.min(CARRY_DRAW.inMost,Math.max(CARRY_DRAW.in,Math.hypot(c.ox,c.oy,c.oz)/CARRY_DRAW.inPace));}
    c.k=Math.min(1,c.k+(dt>0?dt:0)/c.over);
    const w=1-c.k*c.k*(3-2*c.k),x=spot.x+c.ox*w,y=spot.y+c.oy*w,z=spot.z+c.oz*w;
    if(dt>1e-4){const e=Math.min(1,dt*20),ux=(x-c.x)/dt,uz=(z-c.z)/dt;if(Math.abs(ux)+Math.abs(uz)<60){c.ux+=(ux-c.ux)*e;c.uz+=(uz-c.uz)*e;}}
    c.x=x;c.z=z;
    this.drawn.set(x,y,z);this.velocity.set(c.ux,0,c.uz);
    this.carryLook.id=id;this.carryLook.k=c.k;
  }

  /** FOOT_DRIBBLE: how much further on (m, along the carry's heading; less than 0 nearer) the carried ball
   *  is drawn than its spot `base` m out from the body, for the dribble's touches: each time the carrier's touching foot
   *  reaches the front of its stride the ball is met there - just in front of that foot - and nudged on `out` m (by the
   *  run's pace), rolling back to the foot by its next touch. Without the feet (a body not yet built) the touches keep
   *  a cadence by the pace alone. None at a walk. */
  private dribble(id:string,body:THREE.Vector3,heading:number,speed:number,base:number,r:number,seconds:number,kick=false){
    const D=FOOT_DRIBBLE,ux=Math.sin(heading),uz=Math.cos(heading);
    let t=this.dribbles.get(id);
    if(!t){t={at:-Infinity,period:D.period,peak:NaN,rel:[NaN,NaN],rising:[false,false],steps:0,lastPeak:-Infinity,touch:base,out:0,shown:0,seen:seconds};this.dribbles.set(id,t);if(this.dribbles.size>12)for(const k of this.dribbles.keys()){if(k!==id){this.dribbles.delete(k);break;}}}
    const running=speed>=D.from;
    if(this.feetOf(id,this.footL,this.footR)){
      for(let k=0;k<2;k++){
        const f=k?this.footR:this.footL,rel=(f.x-body.x)*ux+(f.z-body.z)*uz,was=t.rel[k],rising=rel>was+1e-4;
        // (A foot at the front of its stride: its along-the-run place stops rising.)
        if(Number.isFinite(was)&&t.rising[k]&&!rising&&was>D.front&&running){
          if(seconds-t.lastPeak>.12&&seconds-t.lastPeak<1.2)t.period=THREE.MathUtils.clamp(2*(seconds-t.lastPeak),D.least,D.most);
          t.lastPeak=seconds;t.steps++;
          if(t.steps%2===0&&seconds-t.at>=t.period*.8){t.at=seconds;t.touch=Math.min(base,was+r*D.meet);t.out=Math.min(D.outMost,D.out+D.outPer*speed);}
        }
        t.rel[k]=rel;t.rising[k]=rising;
      }
    }else if(running&&seconds-t.at>=THREE.MathUtils.clamp(D.pace/speed,D.least,D.most)){t.at=seconds;t.period=THREE.MathUtils.clamp(D.pace/speed,D.least,D.most);t.touch=base-r*.6;t.out=Math.min(D.outMost,D.out+D.outPer*speed);}
    // (Met at the foot, out ahead mid-stride, back to the foot for the next one; with no next one, eased back to its spot.)
    const u=(seconds-t.at)/t.period,back=t.touch-base;
    // (A PASS or a SHOOT winding up: the ball set back by the foot that strikes it - FOOT_DRIBBLE.kick ball radii nearer.)
    const want=kick?-r*D.kick:u>=0&&u<1?back+(t.out-back)*Math.sin(Math.PI*u):u>=1&&u<2?back*(2-u):0;
    const dt=Math.min(.1,Math.max(0,seconds-t.seen));t.seen=seconds;
    t.shown+=(want-t.shown)*Math.min(1,dt*D.ease);
    return t.shown;
  }
  private readonly dribbles=new Map<string,{at:number;period:number;peak:number;rel:[number,number];rising:[boolean,boolean];steps:number;lastPeak:number;touch:number;out:number;shown:number;seen:number}>();
  private readonly footL=new THREE.Vector3();private readonly footR=new THREE.Vector3();
  /** The drawn feet of a body (main.ts: its LeftFoot and RightFoot), into `l` and `r`; false without them. */
  feetOf:(id:string,l:THREE.Vector3,r:THREE.Vector3)=>boolean=()=>false;
  /** The drawn body's facing (rad, the heading's sense: 0 along +z; main.ts: its group's turn), or undefined. */
  facingOf:(id:string)=>number|undefined=()=>undefined;

  /** The base's own flight run on to `at` (server s) into this.sim: it stands still while stopped or clashing, then flies. */
  private flown(at:number){
    const b=this.base,from=Math.max(this.baseServer,b.frozenUntil,b.clash),age=Math.min(.5,Math.max(0,at-from));
    copyBall(this.sim,b);this.sim.held=false;
    for(let left=age;left>1e-5;left-=1/60)stepBall(this.mode!,this.sim,Math.min(1/60,left),this.contacts);
    return this.sim;
  }

  private timed(serverTime:number,view:BallView){
    const b=this.base,next=view.next??null,nextAt=view.nextAt??-1,span=nextAt-this.baseServer;
    const s=next&&span>1e-4?Math.min(1,Math.max(0,(serverTime-this.baseServer)/span)):0;
    if(b.held||next?.held&&s>0){
      // In a hand (a serve, a catch): from where the base has it to where the next has it.
      const to=next??b;this.drawn.set(b.x+(to.x-b.x)*s,b.y+(to.y-b.y)*s,b.z+(to.z-b.z)*s);this.velocity.set(0,0,0);return;
    }
    if(next!==this.nextRef||nextAt!==this.nextAt){
      this.nextRef=next;this.nextAt=nextAt;this.miss.set(0,0,0);
      if(next&&span>1e-4){
        const f=this.flown(nextAt);this.miss.set(next.x-f.x,next.y-f.y,next.z-f.z);
        // A reset (a kickoff, a new serve) is not bent toward: the ball holds its flight and is there at the next.
        if(this.miss.lengthSq()>SNAP*SNAP)this.miss.set(0,0,0);
      }
    }
    const f=this.flown(serverTime),w=s*s*(3-2*s),still=b.frozenUntil>serverTime||b.clash>serverTime;
    this.drawn.set(f.x+this.miss.x*w,f.y+this.miss.y*w,f.z+this.miss.z*w);
    if(still)this.velocity.set(0,0,0);
    else{const rate=span>1e-4?6*s*(1-s)/span:0;this.velocity.set(f.vx+this.miss.x*rate,f.vy+this.miss.y*rate,f.vz+this.miss.z*rate);}
  }

  /** Where a ball in the air will come down (physics.ts landing), once a snapshot: Sky Spike's in whose court. (From
   *  the ball drawn ahead of the frame while it is - `landFrom` - else the snapshot's.) */
  private forecast(){this.landFrom(this.base,this.baseAt);}
  private landFrom(b:BallState,at:number){
    const mode=this.mode!,r=ballRadius(mode),land=this.land;
    land.show=false;this.landAt=at;
    if(b.held||b.y<(mode==='goal-rush'?2:r+.4))return;
    const l=landing(mode,b);
    // (Sky Spike's on the court the ball carries - volleyball's for three a side, else the classic's.)
    const C=spikeCourt(b),R=mode==='goal-rush'?GOAL_RULES:{halfX:C.wallX,halfZ:C.wallZ};
    if(l.t<.08||Math.abs(l.x)>R.halfX-r||Math.abs(l.z)>R.halfZ-r)return;
    land.x=l.x;land.z=l.z;land.t=l.t;land.show=true;land.team=mode==='sky-spike'?courtSide(l.x,l.z,C)??null:null;
  }

  /** A wall, the dome or the floor the ball rebounded off since the last snapshot: its velocity turned round there. */
  private rebounds(){
    const p=this.prev,b=this.base,mode=this.mode!,r=ballRadius(mode),C=spikeCourt(b),R=mode==='goal-rush'?GOAL_RULES:{halfX:C.wallX,halfZ:C.wallZ};
    if(p.held||b.held||Math.hypot(p.vx,p.vy,p.vz)<7)return;
    const dome=mode==='sky-spike',inMouth=!dome&&Math.abs(b.x)<GOAL_RULES.goalHalfWidth&&b.y<GOAL_RULES.goalHeight;
    if(p.vx*b.vx<0&&Math.abs(b.x)>R.halfX-r-.6)this.wall(Math.sign(p.vx)*R.halfX,b.y,b.z,1,0,Math.abs(p.vx),dome);
    if(p.vz*b.vz<0&&Math.abs(b.z)>R.halfZ-r-.6&&!inMouth)this.wall(b.x,b.y,Math.sign(p.vz)*R.halfZ,0,1,Math.abs(p.vz),dome);
    if(p.vy<-6&&b.vy>0&&b.y<r+.8)this.floor(b.x,b.z,-p.vy);
  }

  private moments(view:BallView,serverTime:number,seconds:number){
    const events=view.events;
    for(let i=0;i<events.length;i++){
      const e=events[i];if(e.id<=this.lastEvent)continue;this.lastEvent=e.id;
      // Only what is happening now: a page that joins late, or hitches, does not replay a backlog.
      if(serverTime-e.at>1.2)continue;
      // (The page's own touch whose moment was drawn when it was forecast, the same moment.)
      const told=this.told;
      if(told&&e.actorId===this.self&&e.kind===told.kind&&!!e.perfect===told.perfect&&seconds-told.at<1.2){this.told=null;continue;}
      this.moment(e,view);
    }
  }

  private dress(view:BallView,selfId:string,camera:THREE.Camera,dt:number,seconds:number,serverTime:number){
    // RUMBLE's GIANT BALL swells it (and lets it go) over a few frames.
    this.grown+=((this.base.size||1)-this.grown)*Math.min(1,dt*6);
    // (Football's full-power hang at the boot - FOOTBALL.fun.full, a tenth of a second - is the shot's beat, not
    // a ball stopped in time: it keeps its look, no pale ice and no clock.)
    const b=this.lookBall(),r=ballRadius(view.mode)*this.grown,frozen=this.frozen&&!(view.football&&this.freezeLength<=.2+1e-6),speed=this.velocity.length(),fx=this.fx;
    const volley=!!view.volley;
    this.ball.scale.setScalar(view.football?footDrawn(r,camera,b):volley?volleyDrawn(r,camera,b):r);
    if(!frozen)this.time.value+=dt;
    // (Volleyball: the ball has no heat - no fire, no tier rings, no embers; HEAT is off its HUD too.)
    this.heat+=((view.volley?0:b.heat)-this.heat)*Math.min(1,dt*8);this.flash=Math.max(0,this.flash-dt*6);
    const tier=heatTier(this.heat+.05),hot=!frozen&&!b.held;
    // A SUPER SHOT wears its striker's own ultimate colours (and a bespoke one its motif); a LINK SHOT both
    // fighters' colours. Otherwise the side's colour, as ever.
    let team=b.lastTeam?TEAM[b.lastTeam]:NEUTRAL,second=team,motif:ReturnType<typeof superLook>['motif'];
    const striker=this.fighterOf(view,b.lastId);
    if(b.super&&striker){const look=superLook(striker);team=look.a;second=look.b;motif=look.motif;}
    else if(b.link&&striker){team=fighterColour(striker,this.linkA);second=fighterColour(this.fighterOf(view,b.link),this.linkB);}
    this.ball.position.copy(this.drawn);this.ball.visible=true;
    // (Volleyball: the ball on the hands that play it - MEET.)
    if(volley&&!b.held&&!frozen)this.ball.position.add(this.meet(view,serverTime,camera));else{this.onHands.set(0,0,0);this.overBody=false;}
    {const over=this.overBody;if(!this.onTop&&this.bodyMaterial.depthTest===over){this.bodyMaterial.depthTest=this.outlineMaterial.depthTest=!over;this.bodyMesh.renderOrder=over?21:0;this.outline.renderOrder=over?20:-1;}}
    // (Football: the ball over every body and mark - FOOT_DRAW.order: its halo, its ink, its face, each drawn
    // in the transparent pass after the bodies, in that order, without the depth test.)
    {const top=!!view.football&&!frozen;if(top!==this.onTop){this.onTop=top;const o=FOOT_DRAW.order;
      this.bodyMaterial.depthTest=this.outlineMaterial.depthTest=this.haloMaterial.depthTest=!top;
      this.bodyMesh.renderOrder=top?o+2:0;this.outline.renderOrder=top?o+1:-1;this.halo.renderOrder=top?o:-2;}}
    // The spin the room sent, and the roll: on the floor it rolls true (up x v / r), in the air a little topspin.
    if(!frozen){
      if(b.held)this.omega.set(0,1.2,0);
      else{const roll=this.drawn.y<=r+.06?1:.35;this.omega.set(b.sx+this.velocity.z/r*roll,b.sy,b.sz-this.velocity.x/r*roll);}
      const rate=this.omega.length();
      if(rate>1e-4){this.axis.copy(this.omega).divideScalar(rate);this.turn.setFromAxisAngle(this.axis,rate*dt);this.spinner.quaternion.premultiply(this.turn);}
    }
    // A ball with character. Its shape: flattened along a blow for a breath at contact (`press`), then
    // lengthened along its flight by its speed - its volume kept (what it loses along the axis it gains across it).
    {
      const pressed=seconds-this.pressAt,env=pressed>=0&&pressed<SHAPE.squashFor?(1-pressed/SHAPE.squashFor)**2*this.pressBy:0;
      let to=1;
      if(env>.02){this.shapeAxis.copy(this.pressAxis);to=1-SHAPE.squash*env;}
      else if(!b.held&&!frozen&&speed>SHAPE.from){this.shapeAxis.copy(this.velocity).divideScalar(speed);to=1+Math.min(SHAPE.stretch,(speed-SHAPE.from)/SHAPE.over);}
      this.length+=(to-this.length)*Math.min(1,dt*(env>.02?70:14));
      const across=1/Math.sqrt(this.length);
      this.shaper.quaternion.setFromUnitVectors(UP,this.shapeAxis);this.unshaper.quaternion.copy(this.shaper.quaternion).invert();this.shaper.scale.set(across,this.length,across);
      this.look.along=this.length;
    }
    // Its turn: the spin the room gave it (a curve's, a float's, a JUMP SERVE's topspin), drawn in lines round it while
    // it is in the air. (Its roll along the floor is read off its panels.)
    {
      const spin=b.held||frozen?0:Math.hypot(b.sx,b.sy,b.sz),show=this.drawn.y>r+.12?smooth(spin,SHAPE.spinFrom,SHAPE.spinFull):0;
      this.spinShown+=(show-this.spinShown)*Math.min(1,dt*10);
      const lines=this.spinShown>.03&&spin>1e-3;this.spinLines.visible=lines;this.look.spin=lines?this.spinShown:0;
      if(lines){
        this.axis.set(b.sx,b.sy,b.sz).divideScalar(spin);this.spinLines.quaternion.setFromUnitVectors(UP,this.axis);
        this.spinTurn=(this.spinTurn+Math.min(spin,12)*dt*.15915494)%1;
        const l=this.spinLines.material.uniforms;l.uTurn.value=this.spinTurn;l.uAmount.value=this.spinShown*(1-this.thin);
      }
    }
    const u=this.bodyMaterial.uniforms;
    u.uHeat.value=this.heat;u.uFreeze.value=frozen?1:0;u.uSuper.value=b.super?1:0;u.uFlash.value=this.flash;(u.uTeam.value as THREE.Color).copy(team);
    this.gear.dress(this.bodyMaterial,view,selfId);
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
    (this.outlineMaterial.uniforms.uColor.value as THREE.Color).setHex(frozen?0xf2f2f4:0x050506);
    // The ink outline thickens a little as the ball heats, so its edge holds against the fire round it.
    this.outline.scale.setScalar((volley?VOLLEY_DRAW.outline:1.075)+Math.min(1,this.heat/4)*.05);
    // (Football's ink line and halo, a few pixels wide whatever the ball's size on screen - FOOT_DRAW.)
    if(view.football){
      const lens=camera as THREE.PerspectiveCamera,h=typeof innerHeight==='number'&&innerHeight>0?innerHeight:720,drawnR=this.ball.scale.x;
      const px=lens.isPerspectiveCamera?drawnR/Math.max(.2,lens.position.distanceTo(this.drawn))/Math.tan(lens.fov*Math.PI/360)*h/2:20;
      const ink=1+Math.max(.075,FOOT_DRAW.ink/Math.max(2,px));
      this.outline.scale.setScalar(ink);this.halo.scale.setScalar(ink+FOOT_DRAW.halo/Math.max(2,px));this.halo.visible=!frozen;
    }else this.halo.visible=false;
    const a=this.auraMaterial.uniforms,size=r*(3.2+tier*.5)+(b.super?r*1.2:0);
    this.aura.visible=this.heat>=.9||b.super;
    a.uHeat.value=this.heat;a.uSuper.value=b.super?1:0;a.uFreeze.value=frozen?1:0;a.uGlow.value=FIRE_GLOW*(.55+.45*VFX.glow);a.uSize.value=size;a.uR.value=r/size;a.uLift.value=r*1.05;
    (a.uVel.value as THREE.Vector3).copy(this.velocity);(a.uTeam.value as THREE.Color).copy(team);
    // The trail: a point wherever the ball has gone a fifth of a metre, the newest following it every frame, the
    // oldest let go after its life; wider for a faster, hotter ball, nothing at a roll.
    // (None behind a carried ball - it runs at a body's pace at a body's feet, and the ring under it says whose.)
    // (Volleyball: a short ribbon off a ball struck hard only - VOLLEY_DRAW.)
    // (Football: a short ribbon off a hard hit only - FOOT_DRAW.)
    const foot=!!view.football&&!b.super;
    const life=volley&&!b.super?VOLLEY_DRAW.trailLife:foot?FOOT_DRAW.trailLife:.3+tier*.06+(b.super?.25:0),width=(volley&&!b.super?Math.min(1,Math.max(0,(speed-VOLLEY_DRAW.trailFrom)/6)):foot?Math.min(1,Math.max(0,(speed-FOOT_DRAW.trailFrom)/(FOOT_DRAW.trailFull-FOOT_DRAW.trailFrom))):Math.min(1,Math.max(0,(speed-3)/14)))*r*2*(1+tier*.22)*(b.super?1.35:1)*(this.carried?1-this.carried.k:1),stroke=this.gear.trailColour(view,b,team);
    if(!frozen){
      this.trailClock+=dt;const trail=this.trail;
      // The ribbon's colours: a SUPER SHOT's or a LINK SHOT's own two, else the striker's ball gear trail.
      const edgeA=b.super||b.link?team:stroke,edgeB=b.super||b.link?second:stroke;
      if(trail.count<2){trail.push(this.drawn,this.trailClock,width,edgeA,edgeB);trail.push(this.drawn,this.trailClock,width,edgeA,edgeB);}
      else{
        const s=trail.slot(1),d=Math.hypot(this.drawn.x-trail.x[s],this.drawn.y-trail.y[s],this.drawn.z-trail.z[s]);
        if(d>.2)trail.push(this.drawn,this.trailClock,width,edgeA,edgeB);else trail.set(0,this.drawn,this.trailClock,width,edgeA,edgeB);
      }
      while(trail.count>2&&this.trailClock-trail.t[trail.slot(trail.count-1)]>life)trail.count--;
    }
    this.eye.setFromMatrixPosition(camera.matrixWorld);
    // A power shot's path, left hanging as a brush stroke for a second: a point every SHAPE.strokeGap behind
    // the ball while it is being drawn, each let go SHAPE.strokeFor after it was laid.
    if(!frozen){
      const st=this.strokeTrail,w=r*SHAPE.strokeWidth,c=this.strokeColour;
      if(this.strokeLeft>0){
        this.strokeLeft=b.held||speed<8?0:this.strokeLeft-dt;
        if(st.count<2){st.push(this.drawn,this.trailClock,w,c);st.push(this.drawn,this.trailClock,w,c);}
        else{
          const s=st.slot(1),d=Math.hypot(this.drawn.x-st.x[s],this.drawn.y-st.y[s],this.drawn.z-st.z[s]);
          if(d>SHAPE.strokeGap)st.push(this.drawn,this.trailClock,w,c);else st.set(0,this.drawn,this.trailClock,w,c);
        }
      }
      while(st.count>0&&this.trailClock-st.t[st.slot(st.count-1)]>SHAPE.strokeFor)st.count--;
      if(st.count<2&&this.strokeLeft<=0)st.count=0;
    }
    this.stroke.mesh.visible=this.strokeTrail.count>=2;
    if(this.stroke.mesh.visible)this.stroke.build(this.strokeTrail,this.eye,this.trailClock,SHAPE.strokeFor,1,true);
    // The ball stays big, so where it crosses the lens it would cover the play: past
    // SHAPE.thinFrom of the frame's height across it thins to its outline, and the fighters behind it stay in sight.
    {
      const share=r/Math.max(.1,this.eye.distanceTo(this.drawn))*camera.projectionMatrix.elements[5];
      this.thin+=(smooth(share,SHAPE.thinFrom,SHAPE.thinFull)-this.thin)*Math.min(1,dt*12);
      const thin=this.thin>.02?this.thin:0,see=thin>0;
      u.uThin.value=thin;this.outlineMaterial.uniforms.uThin.value=thin;a.uGlow.value*=1-thin*.85;this.haloMaterial.opacity=FOOT_DRAW.alpha*(1-thin);
      this.bodyMaterial.transparent=this.outlineMaterial.transparent=see||this.onTop;this.bodyMaterial.depthWrite=this.outlineMaterial.depthWrite=thin<.5;
      this.look.share=share;this.look.thin=thin;
    }
    this.ribbon.mesh.material.uniforms.uHeat.value=this.heat/4;
    this.ribbon.build(this.trail,this.eye,this.trailClock,life,1);
    this.superTrail.mesh.visible=b.super;if(b.super)this.superTrail.build(this.trail,this.eye,this.trailClock,life,2.6);
    // What a hot ball throws off: embers from two, sparks from three, lightning at four; white streaks when it flies.
    const vx=this.velocity.x,vy=this.velocity.y,vz=this.velocity.z,{x,y,z}=this.drawn,gain=VFX.spriteGain;
    if(hot){
      this.embers+=(tier>=2?14:0)*dt*gain;this.sparks+=(tier>=3?(tier>=4?48:36):0)*dt*gain;this.bolts+=(tier>=4?16:0)*dt*gain;
      // (While a power shot's stroke is being drawn the stroke is its path - no streaks and no smoke trail
      // over it, or the one shot would be drawn four ways at once.)
      const stroked=this.strokeLeft>0;
      this.streaks+=(speed>16&&!stroked&&!volley?Math.min(60,(speed-14)*2.2):0)*dt*VFX.speedLines;
      // The smoke trail (a big readable ball trailing smoke): manga clouds left behind a
      // fast ball - paper, warmer as it burns, ash at OVERDRIVE - born small a ball and a half behind it and swelling as
      // they wear away, so they never stand over its face.
      this.smoke+=(speed>11&&!stroked&&!volley?Math.min(42,(speed-11)*2.1):0)*dt*gain;
      for(;this.smoke>=1;this.smoke--){
        const s=Math.max(speed,1),back=r*(1.5+Math.random()*1.2),j=this.randomDirection(r*.35);
        const o=fx.spawn(K.cloud,x-vx/s*back+j.x,y-vy/s*back+j.y,z-vz/s*back+j.z,-vx*.05+j.x*2,.35+Math.random()*.4,-vz*.05+j.z*2,.34+Math.random()*.2+tier*.04,r*.5,r*(1.25+tier*.16+Math.min(.6,speed/60)),tier>=4?ASH:tier>=2?WARM:PAPER,.82);
        fx.data[o+DRAG]=3;
      }
      for(;this.embers>=1;this.embers--){const off=this.rim(r*1.05),o=fx.spawn(K.spark,x+off.x,y+off.y,z+off.z,-vx*.08+(Math.random()-.5)*2,-vy*.08+Math.random()*2.5,-vz*.08+(Math.random()-.5)*2,.5,r*.22,r*.08,tier>=4?PINK:GOLD,.9);fx.data[o+DRAG]=1.5;}
      for(;this.sparks>=1;this.sparks--){
        const off=this.rim(r*1.15);
        const o=fx.spawn(K.spark,x+off.x,y+off.y,z+off.z,-vx*.18+(Math.random()-.5)*7,-vy*.18+(Math.random()-.2)*7,-vz*.18+(Math.random()-.5)*7,.32,r*.2,r*.1,tier>=4?(Math.random()<.5?WHITE:PINK):this.tint.setRGB(1,.35+Math.random()*.4,.1),1);
        fx.data[o+GRAV]=9;fx.data[o+DRAG]=2;fx.data[o+STRETCH]=3;fx.data[o+FLAGS]=ALONG_FLIGHT;
      }
      for(;this.bolts>=1;this.bolts--){
        const ax=Math.random()-.5,ay=Math.random()-.5,az=Math.random()-.5,l=Math.hypot(ax,ay,az)||1,reach=r*(1.9+Math.random()*1.2);
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
      if(b.super&&motif)this.motif(motif,dt,r,team,second);
      // A LINK SHOT: both colours thrown off it, a spark of each.
      else if(b.link&&!b.super){this.linkSparks+=40*dt*gain;for(;this.linkSparks>=1;this.linkSparks--){const off=this.rim(r*1.2),c=this.linkSparks%2<1?team:second,o=fx.spawn(K.spark,x+off.x,y+off.y,z+off.z,-vx*.2+off.x*4,-vy*.2+off.y*4,-vz*.2+off.z*4,.35,r*.2,r*.08,c,1);fx.data[o+DRAG]=2.5;fx.data[o+STRETCH]=3;fx.data[o+FLAGS]=ALONG_FLIGHT;}}
      // A burning ball lights the turf and the fighters round it through the pooled lights (vfx/LightPool, at the VISUAL
      // EFFECTS level's share), more and further the hotter it is; none on the LOW quality.
      if(this.heat>=1&&this.kit.quality!=='low'){const k=Math.min(1,(this.heat-.9)/3.3);this.kit.lights.request(x,Math.max(y,.7),z,HEAT_LIGHT[tier],5+k*19,5+k*5,1.6+k*1.4);}
    }else this.embers=this.sparks=this.bolts=this.streaks=this.smoke=0;
    if(!frozen)this.gear.trail(this.emit,view,b,this.drawn,this.velocity,speed,r,dt,gain);
    fx.step(frozen?0:dt);
    fx.begin();
    // The shadow straight under the ball, softer and wider the higher it is; a fine ring to find it by when high.
    const height=Math.max(0,y-r);
    // (SPORT mode: the small ball's ring is always lit and never smaller than a stride's half metre, to find it by.)
    if(view.football)fx.put(K.shadow,x,.035,z,Math.max(FOOT_RING,r*(1.15+height*.06)),INK,Math.max(FOOT_DRAW.shadowAlpha,.6/(1+height*.15)),Math.max(.6,Math.min(1,Math.max(0,(height-1.5)/4))*.6));
    // (Volleyball: always there and always dark enough to find - a ball's shadow is where it is over the court.)
    else if(volley)fx.put(K.shadow,this.ball.position.x,.035,this.ball.position.z,Math.max(VOLLEY_DRAW.shadow,r*(1.15+height*.05)),INK,Math.max(VOLLEY_DRAW.shadowAlpha,.7/(1+height*.12)),height>VOLLEY_DRAW.ringFrom?.75:0);
    else fx.put(K.shadow,x,.035,z,r*(1.15+height*.06),INK,.55/(1+height*.22),Math.min(1,Math.max(0,(height-1.5)/4))*.6);
    // A carried ball's one sign of whose it is - a ring in the carrier's side's colour on the floor round it, as
    // each fighter's own lies under them - so a team-mate knows to run and the other side whom to tackle.
    const holder=this.carried;
    if(holder?.team)fx.put(K.side,x,.045,z,r*CARRY_DRAW.ring,TEAM[holder.team],CARRY_DRAW.alpha*holder.k,0);
    // Each fighter's side, in a ring on the floor under them (yours brighter, and doubled). (The others'
    // step back - TeamTrim.ts sideRing - now that each body wears its side's colour.)
    const ring=sideRing();let myTeam:BallTeam|undefined;
    if(view.football)for(let i=0;i<view.seats.length;i++)if(view.seats[i].id===selfId){myTeam=view.seats[i].team;break;}
    if(view.phase!=='lobby')for(let i=0;i<view.seats.length;i++){
      const seat=view.seats[i],at=this.where(seat.id,this.spot);if(!at)continue;
      const own=seat.id===selfId;
      // (Football - FOOT_RINGS: your own one thin ring, a team-mate's fainter, none under a rival.)
      if(view.football){const F=FOOT_RINGS,mate=!own&&!!myTeam&&seat.team===myTeam,c=view.arena==='dust-yard'&&seat.team==='red'?SAND_RED:TEAM[seat.team];if(own)fx.put(K.side,at.x,.04,at.z,F.own,c,F.ownAlpha,0);else if(mate)fx.put(K.side,at.x,.04,at.z,F.mate,c,F.mateAlpha,0);}
      // (The volleyball rules: not a ring under every body - one mark on the floor for the person, under your own feet,
      // and none under anyone else's: their kits say their sides.)
      else if(own||!volley)fx.put(K.side,at.x,.04,at.z,own?1.05:ring.size,TEAM[seat.team],own?1:ring.alpha,own?1:0);
      // (Where it was a frame ago and how fast it goes, for the skid it may leave.)
      let m=this.bodies.get(seat.id);
      if(!m){m={x:at.x,z:at.z,vx:0,vz:0,skid:-Infinity};this.bodies.set(seat.id,m);}
      else if(dt>1e-4){const k=Math.min(1,dt*10),mx=(at.x-m.x)/dt,mz=(at.z-m.z)/dt;if(Math.abs(mx)+Math.abs(mz)<80){m.vx+=(mx-m.vx)*k;m.vz+=(mz-m.vz)*k;}m.x=at.x;m.z=at.z;}
    }
    this.marks.update(seconds);this.marks.mesh.visible=seconds<this.marksUntil;
    // Where it comes down, closing in as it falls: Sky Spike's in the colour of the court it lands in (urgent on your
    // own side), a cross when it lands out; Goal Rush's a quiet ring.
    const land=this.land,left=land.t-Math.max(0,seconds-this.landAt);
    // (VOLLEYBALL - game/ball/volley.ts: your ball to receive or set is the same sight in your colour on the
    // touch's own spot, closing on its best moment - the beat to press PLAY on; the others' as before, never pulsing.)
    const vol=view.volley,yours=!!vol&&vol.owner===selfId&&(vol.touch===1||vol.touch===2),until=vol?vol.at-(this.baseServer+(seconds-this.baseAt)):0;
    if(vol&&yours&&!b.held&&!frozen&&until>-.15){
      let team:BallTeam|undefined;for(let i=0;i<view.seats.length;i++)if(view.seats[i].id===selfId){team=view.seats[i].team;break;}
      const pulse=.75+.25*Math.sin(seconds*22);
      // (On the volleyball rules' smaller court the ring closes from half as far out.)
      fx.put(K.landing,vol.x,.045,vol.z,(r*1.6+Math.min(Math.max(0,until),1.6)*LAND_CLOSE.volley)*1.12,team?TEAM[team]:WHITE,.95*pulse,0,0,0,seconds*1.4,.5);
    }
    else if(land.show&&!b.held&&!frozen&&left>0){
      let mine=false;for(let i=0;i<view.seats.length;i++)if(view.seats[i].id===selfId){mine=!vol&&!!land.team&&view.seats[i].team===land.team;break;}
      const spike=view.mode==='sky-spike',colour=spike?land.team?TEAM[land.team]:WHITE:PALE,pulse=mine?.75+.25*Math.sin(seconds*22):1;
      fx.put(K.landing,land.x,.045,land.z,(r*1.6+Math.min(left,1.6)*(vol?LAND_CLOSE.volley:LAND_CLOSE.classic))*(mine?1.12:1),colour,(spike?.95:.5)*pulse,0,spike&&!land.team?1:0,0,seconds*1.4,.5);
    }
    fx.layer(0);fx.layer(1);
    // The stopped clock round a ball whose time has stopped, the time left running down its rim.
    if(frozen)fx.put(K.clock,x,y,z,r*3.2,CLOCK,1,-seconds*6,0,Math.max(0,Math.min(1,(b.frozenUntil-serverTime)/this.freezeLength)),0,0);
    fx.layer(2);fx.end();
  }

  // ---------------------------------------------------------------- moments

  private moment(e:BallEvent,view:BallView){
    // (On the sport rules' football every mark but a goal's is small and short at the touch - FOOT_QUIET.)
    this.quiet=view.football&&e.kind!=='goal'&&e.kind!=='own-goal'?FOOT_QUIET.size:1;
    // (SPORT mode, `?football`: an ordinary save - the keeper's catch, a block - is the game's, not a moment: no burst, no
    // ring, no flash; only a great one (a shot of 31 m/s or more stopped, or off the line: BallHud's rule) is.)
    if(view.football&&e.kind==='save'&&!(e.text==='OFF THE LINE'||(e.value??0)>=31))return;
    // The crowd: on its feet for a goal, up for a clash, a save, a post, a super shot.
    this.gear.burst(this.emit,e,view,VFX.spriteGain);
    // (Goal Rush's TRAP - a 'perfect' event with the text TRAP, twenty a match - is the sport's first touch,
    // not a moment the stands rise for.)
    const trap=e.kind==='perfect'&&e.text==='TRAP';
    const hype=trap?0:({goal:1,'own-goal':1,clash:.75,super:.7,save:.55,perfect:.55,post:.5,shield:.6,win:1} as Partial<Record<BallEvent['kind'],number>>)[e.kind];
    if(hype)crowdHype.value=Math.max(crowdHype.value,hype);
    const team=e.team?TEAM[e.team]:WHITE,n=(k:number)=>Math.max(1,Math.round(k*VFX.spriteGain)),r=ballRadius(view.mode),mk=markScale(r);
    // (A power shot's stroke ends where the ball is next met.)
    if(e.kind!=='chat'&&e.kind!=='accolade')this.strokeLeft=0;
    switch(e.kind){
      case 'goal':case 'own-goal':{
        // A goal. One drawn blast out of the mouth - the engine's own (`ink`), in the scorers' colour with
        // the scorer's own at its edge - where a burst, a hit star, focus lines, two shocks, two rings and dust along
        // the floor, ink smoke, paper clouds, chips and two showers of sparks went off at once.
        const sz=Math.sign(e.z)||1,x=e.x,y=Math.max(1.4,Math.min(e.y,GOAL_RULES.goalHeight-.6)),z=e.z;
        const scorer=e.kind==='goal'?this.fighterOf(view,e.actorId):undefined;
        this.ink('blast',x,y,z-sz*.6,5.4,.62,team,scorer?fighterColour(scorer,this.linkA):this.deep.copy(team).multiplyScalar(.4),0,0,0,2.3);
        // The goal goes up - columns of the scorers' colour thrown up out of the mouth, the middle one tallest,
        // burning hot enough that the INK FLASH leaves them in colour on the inked page.
        for(let i=-2;i<=2;i++){
          const lean=i*.3,h=i===0?10:i*i===1?7.5:5.5,w=i===0?2:i*i===1?1.6:1.2,ax=lean,ay=1,l=Math.hypot(ax,ay);
          const o=this.fx.spawn(K.pillar,x+i*1.5+lean*h*.5,h*.5,z-sz*.4,0,0,0,.6+.12*(2-Math.abs(i)),w*.75,w,team,1),d=this.fx.data;
          d[o+FLAGS]=ALONG_AXIS;d[o+AX]=ax/l;d[o+AY]=ay/l;d[o+AZ]=0;d[o+STRETCH]=h/w*.55;
        }
        // And confetti in the scorers' colour.
        for(let i=0;i<n(110);i++){
          const roll=Math.random(),o=this.fx.spawn(K.confetti,x+(Math.random()-.5)*4,y,z,(Math.random()-.5)*18,10+Math.random()*11,-sz*(3+Math.random()*10),3+Math.random()*1.6,.16+Math.random()*.08,.16,roll<.6?team:roll<.85?WHITE:GOLD,1);
          const d=this.fx.data;d[o+GRAV]=9;d[o+DRAG]=1.4;d[o+FLAGS]=FLUTTER|FLOOR;d[o+SPIN]=(Math.random()-.5)*14;
        }
        // The pitch remembers where it was struck from.
        if(e.kind==='goal')this.struckFrom(view,e,team);
        break;
      }
      case 'post':{
        // The clang. One mark, the engine's drawn blade spark in gold, thrown the way the ball came off the
        // iron (a hit star, a glint, two shocks and a shower of sparks before).
        const s=Math.min(1,.5+(e.value??20)/50),b=view.ball,v=Math.hypot(b.vx,b.vy,b.vz),k=v>1?1/v:0;
        this.ink('slash',e.x,e.y,e.z,mk*(1.4+1.1*s),.3,GOLD,this.deep.copy(GOLD).multiplyScalar(.35),b.vx*k,b.vy*k,b.vz*k,2);
        this.press(b.vx*k,b.vy*k,b.vz*k,s);this.flash=1;
        break;
      }
      case 'touch':{
        // The volleyball rules: a PERFECT receive, dig or set leaves a crisp mark where it was met - a thin gold ring
        // snapping out from the ball and a white core gone in a tenth of a second (a spike's is its strike's, below).
        if(!view.volley||!e.perfect||e.shot==='spike'||e.shot==='block')break;
        this.ink('ring',e.x,e.y,e.z,mk*1.9,.24,GOLD,this.deep.copy(GOLD).multiplyScalar(.3));
        this.ink('flash',e.x,e.y,e.z,mk*1.1,.12,WHITE,GOLD,0,0,0,2.4);
        this.press(0,1,0,.45);
        break;
      }
      case 'save':case 'perfect':case 'block':{
        // Goal Rush's TRAP (BallMatch TRAP): the ball killed dead at the feet is a small moment of its own - a
        // thin ring on the turf in the trapper's side's colour closing in on the ball's foot, the ball pressed down onto the
        // floor - with none of a PERFECT GUARD's gold ring, glint or flash (TRAP_MARK).
        if(trap){const o=this.fx.spawn(K.settle,e.x,.06,e.z,0,0,0,TRAP_MARK.life,r*TRAP_MARK.from,r*TRAP_MARK.from,team,TRAP_MARK.alpha),d=this.fx.data;d[o+FLAGS]=ALONG_AXIS;d[o+AX]=TRAP_MARK.to/TRAP_MARK.from;this.press(0,1,0,TRAP_MARK.press);break;}
        // A guard. One mark, the engine's brushed ring where the ball met it - pale; a PERFECT one (or a
        // STUFF BLOCK) gold and bigger, with a glint. (The hexagon shield, two shocks, a hit star with its lines, a
        // burst and the sparks are retired.) A DIVING SAVE leaves its skid.
        const perfect=e.kind==='perfect'||e.text==='PERFECT SAVE',c=perfect?GOLD:PALE,d=this.shotDirection(view,e);
        this.ink('ring',e.x,e.y,e.z,mk*(perfect?2.6:2),perfect?.4:.34,c,this.deep.copy(c).multiplyScalar(.3));
        if(perfect)this.ink('flash',e.x,e.y,e.z,mk*1.7,.2,WHITE,GOLD,0,0,0,2.4);
        this.press(d.x,d.y,d.z,perfect?1:.7);this.flash=1;
        if(e.text==='DIVING SAVE')this.skid(e.actorId,0,0,1.5);
        break;
      }
      case 'clash':{
        // A CLASH. One mark as it begins, the engine's barbed burst - white-hot, the colour of the side
        // that wins it through its body, the other's at its edge. (What the ball throws while it is held is `dress`'s.)
        const lost=view.seats.find(s=>s.id===e.targetId)?.team,other=lost?TEAM[lost]:WHITE;
        this.ink('burst2',e.x,e.y,e.z,mk*3,.34,team,this.deep.copy(other).multiplyScalar(.7),0,0,0,2.6);
        this.flash=1;break;
      }
      case 'charm':case 'shield':{
        // RUMBLE: a charm taken (a burst in its colour where it lay), or an IRON WALL / SAFETY NET holding (a shield).
        const c=new THREE.Color(e.charm?CHARM_COLOURS[e.charm]:0xffffff);
        if(e.kind==='charm'){this.fx.spawn(K.burst,e.x,e.y,e.z,0,0,0,.4,.8,3.2,c,1);this.fx.spawn(K.ring,e.x,.3,e.z,0,0,0,.45,.6,4.2,c,1);this.fx.spawn(K.groundRing,e.x,.06,e.z,0,0,0,.6,1,4.6,c,1);this.sparkle(e.x,e.y,e.z,n(16),c,9);}
        else{this.fx.spawn(K.shield,e.x,Math.max(1,e.y),e.z,0,0,0,.5,3,5.2,team,1);this.fx.spawn(K.ring,e.x,Math.max(1,e.y),e.z,0,0,0,.45,.8,5,WHITE,1);this.sparkle(e.x,Math.max(1,e.y),e.z,n(20),team,13);this.flash=1;}
        break;
      }
      case 'pass':{
        // (Football: the pass's kick seen - KICK_ARC.)
        if(view.football)this.kickArc(view,e,0,team);
        break;
      }
      case 'strike':{
        // (Football: the shot's kick seen - KICK_ARC - but a header's.)
        if(view.football&&e.shot!=='header')this.kickArc(view,e,Math.min(1,Math.max(0,((e.value??26)-24)/12)),team);
        // A blow on the ball. One mark, by how hard it was struck (`touch`) - a puff for a soft touch, the
        // engine's drawn burst turned along the shot from there, a real one for a power shot - where it once threw a
        // hit star, focus lines, a shock, sparks, clouds and a glint at every one. A spike struck high over the net is
        // struck as hard as anything; Goal Rush's PERFECT STRIKE is struck gold, a burst whatever its speed.
        // The ball flattens on the blow, and a power shot leaves its path hanging behind it (`path`).
        const sky=e.text==='SKY SPIKE'||e.text==='ROLL SPIKE',gold=!!e.perfect&&!sky,s=sky?.9:gold?Math.max(.95,strikePower(e.value)):strikePower(e.value),d=this.shotDirection(view,e);
        // A LINK SHOT's edge is its setter's colour; a flair shot's gold.
        const setter=e.text==='LINK SHOT'?this.fighterOf(view,e.assistId):undefined,flair=e.text==='BICYCLE KICK'||e.text==='AERIAL'||e.text==='ROLL SPIKE',colour=gold?GOLD:team;
        this.touch(e.x,e.y,e.z,d.x,d.y,d.z,setter||flair?Math.max(s,SOFT):s,colour,setter?fighterColour(setter,this.linkB):flair?GOLD:null,r);
        this.press(d.x,d.y,d.z,s);this.flash=Math.max(this.flash,.45+.45*Math.min(1,s));
        if(s>=HARD&&!view.volley)this.path(colour);
        break;
      }
      case 'super':{
        // An ultimate on the ball. The biggest mark there is and only it - the engine's blast in the shot's
        // own colours, its brushed shockwave round it - and the floor under it scorched; its path hangs behind it.
        const d=this.shotDirection(view,e),fighter=this.fighterOf(view,e.actorId),look=fighter?superLook(fighter):undefined,c=look?.a??team;
        this.ink('blast',e.x,e.y,e.z,mk*3.6,.55,c,look?.b??this.deep.copy(c).multiplyScalar(.4),0,0,0,2.4);
        this.ink('ring',e.x,e.y,e.z,mk*4.2,.45,c,this.deep.copy(c).multiplyScalar(.3));
        this.scorch(e.x,e.z,r*3.4,c);this.press(d.x,d.y,d.z,1);this.flash=1;this.path(c);
        break;
      }
      case 'duel':{
        // A TECHNIQUE DUEL begins: the keeper's guard and the shot meet - the keeper's side's shield up while the ball
        // hangs, and one glint in the shot's colour for the flash, the ring and the two showers of sparks.
        const striker=this.fighterOf(view,e.targetId),look=striker?superLook(striker):undefined;
        this.fx.spawn(K.shield,e.x,e.y,e.z,0,0,0,.7,2.6,4.4,team,1);
        this.ink('flash',e.x,e.y,e.z,mk*2.4,.24,WHITE,look?.a??team,0,0,0,2.4);
        this.flash=1;
        break;
      }
      case 'duel-won':{
        // How it ended. One mark each: the shot dying on the guard - the great shield of the keeper's
        // side's colour and the engine's barbed burst in gold breaking on it - or breaking through, the drawn burst in
        // the striker's colours driving on the way the ball goes.
        if(e.text==='SHOT STOPPED'){
          this.fx.spawn(K.shield,e.x,e.y,e.z,0,0,0,.8,3.4,7.5,team,1);
          this.ink('burst2',e.x,e.y,e.z,mk*3.3,.46,GOLD,this.deep.copy(team).multiplyScalar(.6),0,0,0,2.4);
        }else{
          const striker=this.fighterOf(view,e.actorId),look=striker?superLook(striker):undefined,c=look?.a??team,b=view.ball,v=Math.hypot(b.vx,b.vy,b.vz),k=v>1?1/v:0;
          this.ink('burst',e.x,e.y,e.z,mk*3.3,.42,c,look?.b??this.deep.copy(c).multiplyScalar(.4),b.vx*k,b.vy*k,b.vz*k,2.4);
        }
        this.flash=1;break;
      }
      case 'bowled':case 'demo':{
        // A body knocked flat by a hot ball or a boosting body (BUMP). One barbed burst where it was struck
        // and the skid it leaves on the floor (a hit star, its lines, dust, clouds, chips and a glint before).
        this.ink('burst2',e.x,Math.max(.8,e.y),e.z,mk*1.4,.3,team,this.deep.copy(team).multiplyScalar(.4));
        this.skid(e.targetId,e.kind==='bowled'?view.ball.vx:0,e.kind==='bowled'?view.ball.vz:0,1.4);
        break;
      }
      case 'wipeout':{
        // A WIPE-OUT (Goal Rush's fights): somebody flattened for three seconds. One barbed burst
        // in the wiper's colour where they went down, and a long skid where they slide.
        this.ink('burst2',e.x,Math.max(.9,e.y),e.z,mk*1.9,.36,team,this.deep.copy(team).multiplyScalar(.4),0,0,0,2);
        this.skid(e.targetId,0,0,1.9);
        break;
      }
      case 'tackle':this.skid(e.targetId,0,0,1.5);this.fight.moment(e,view);break;
      case 'reversal':this.skid(e.targetId,0,0,1.2);this.fight.moment(e,view);break;
      case 'dig':if(e.text==='DIVING DIG')this.skid(e.actorId,0,0,1.4);break;
      case 'kill':case 'ace':case 'point':{
        // A point won where the ball came down (the spike slams in). A kill or an ace hardest; a point won
        // otherwise less, and it leaves no dent.
        const big=e.kind==='ace'?1.3:e.kind==='point'?.7:1.1+Math.min(.25,Math.max(0,((e.value??0)-1)*.12));
        this.slam(e.x,e.z,big,team,e.kind!=='point',e.text==='SUPER SHOT'||heatTier(view.ball.heat)>=4);
        if(e.kind==='ace')this.ink('flash',e.x,1.2,e.z,3,.22,WHITE,team,0,0,0,2.4);
        break;
      }
      case 'out':this.kit.puff(e.x,.25,e.z,0,.6,0,.55,this.kit.now,.4,.7);break;
      case 'net':this.kit.puff(e.x,e.y,0,0,.4,0,.4,this.kit.now,.32,.7);break;
      case 'rally':this.fx.spawn(K.ring,e.x,e.y,e.z,0,0,0,.5,1,4.5,GOLD,1);break;
      case 'fever':{
        // (Goal Rush's FINAL PUSH has the place at its peak, not Sky Spike's petals.)
        if(view.mode==='goal-rush'||view.volley)break;
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

  /** The ball off a wall: a hex ripple where it struck (the Ink Bowl's glass, the Sky Court's unseen dome), the ball
   *  flattened on it. (The ring and the clouds round the ripple are retired.) */
  private wall(x:number,y:number,z:number,nx:number,nz:number,speed:number,dome:boolean){
    const s=Math.min(1.4,speed/25);
    this.fx.spawn(K.shield,x,y,z,0,0,0,.4,1+s,2+s*2,dome?PINK:PALE,.85);
    this.press(nx,0,nz,s*.7);this.strokeLeft=0;
  }
  /** The ball off the floor hard: a puff of dust, the ball flattened on it - and where a SUPER SHOT or an
   *  OVERDRIVE ball comes down, the floor scorched. */
  private floor(x:number,z:number,speed:number){
    const s=Math.min(1.4,speed/18),b=this.base;
    this.kit.puff(x,.2,z,0,.5,0,.3+.3*s,this.kit.now,.34,.65);
    this.press(0,1,0,s*.7);this.strokeLeft=0;
    if(b.super||heatTier(b.heat)>=4)this.scorch(x,z,ballRadius(this.mode!)*2.6,b.lastTeam?TEAM[b.lastTeam]:GOLD);
  }
  private puffs(x:number,y:number,z:number,count:number,colour:THREE.Color,size0:number,size1:number,speed:number){
    for(let i=0;i<count;i++){const v=this.randomDirection(speed*(.4+Math.random()*.6)),o=this.fx.spawn(K.smoke,x,y,z,v.x,v.y*.6+speed*.15,v.z,.6+Math.random()*.35,size0,size1*(.8+Math.random()*.4),colour,.95);this.fx.data[o+DRAG]=4;}
  }
  private sparkle(x:number,y:number,z:number,count:number,colour:THREE.Color,speed:number){
    for(let i=0;i<count;i++){const v=this.randomDirection(speed*(.5+Math.random()*.6)),o=this.fx.spawn(K.spark,x,y,z,v.x,v.y,v.z,.35+Math.random()*.2,.16,.06,Math.random()<.5?colour:WHITE,1);const d=this.fx.data;d[o+DRAG]=3;d[o+GRAV]=6;d[o+STRETCH]=3;d[o+FLAGS]=ALONG_FLIGHT;}
  }

  // ---------------------------------------------------------------- marks from the drawn effects

  /** One of the engine's hand-drawn impacts (vfx/inkImpactAtlas.ts: the flipbooks the fighting modes' hits are drawn
   *  with), from the shared kit's sprites: `size` its radius (m), `hot` the colour through its body and `cool` the one at
   *  its edges, turned along (dx, dy, dz) when it is one of the directional ones and a direction is given. A sprite on a
   *  card: no draw of its own, no bloom needed, and drawn at every quality and VISUAL EFFECTS level (at the level's
   *  size). Until the flipbooks have loaded, the procedural shape each replaced. */
  private ink(seq:InkImpact,x:number,y:number,z:number,size:number,life:number,hot:THREE.Color,cool:THREE.Color,dx=0,dy=0,dz=0,heat=1.8){
    // (Volleyball: every impact small and short, at the contact - VOLLEY_FX.)
    if(this.lastView?.volley){size*=VOLLEY_FX.ink;life*=VOLLEY_FX.life;heat=Math.min(heat,VOLLEY_FX.heat);}
    const f=this.kit.sparks,sp=f.spec,book=INK_IMPACTS[seq],ready=inkImpactsReady();
    if(this.quiet<1){size*=this.quiet;life*=FOOT_QUIET.life;}
    sp.reset(ready?SPRITE.ink:seq==='ring'?SPRITE.ring:seq==='flash'?SPRITE.star:SPRITE.burst,this.kit.now,life).pos(x,y,z).sized(size*.85,size,.12);
    sp.r=hot.r;sp.g=hot.g;sp.b=hot.b;sp.intensity=heat;sp.r2=cool.r;sp.g2=cool.g;sp.b2=cool.b;sp.cover=ready?.96:.4;
    sp.inkCell=book.start;sp.inkFrames=book.frames;
    if(book.directional&&dx*dx+dy*dy+dz*dz>.25){sp.axis(dx,dy,dz);sp.rotation=(Math.random()-.5)*.4;}else{sp.axis(0,0,0);sp.rotation=Math.random()*6.283;}
    // (Toward the lens by most of its size, or the ball and the floor cut it along a line.)
    sp.bias=size*.6;f.emit();
  }
  /** A touch's one mark at the ball, by how hard it was struck (`power`: strikePower's): under SOFT a small puff of
   *  paper kicked back off it; from there the drawn burst turned along the shot, bigger the harder - in `colour` (the
   *  striker's side's), with `edge` (a setter's colour, a flair's gold) or a deep shade of it at its rim. */
  private touch(x:number,y:number,z:number,dx:number,dy:number,dz:number,power:number,colour:THREE.Color,edge:THREE.Color|null,r:number){
    const mk=markScale(r);
    if(power<SOFT){
      // The puff: paper kicked back off the ball, shaded in the side's deep colour, so it reads on a pale floor and a
      // night sky alike (the kit's own dust puff is pale on pale).
      const f=this.kit.dust,sp=f.spec,size=mk*(.55+.35*power/SOFT)*this.quiet,shade=edge??this.deep.copy(colour).multiplyScalar(.45);
      sp.reset(SPRITE.puff,this.kit.now,.34).pos(x-dx*r*.5,y-dy*r*.5,z-dz*r*.5).velocity(-dx*1.4,.5-dy*1.2,-dz*1.4);sp.drag=3;sp.gravity=-.5;
      sp.sized(size*.5,size,.5);sp.r=PAPER.r;sp.g=PAPER.g;sp.b=PAPER.b;sp.intensity=1;sp.r2=shade.r;sp.g2=shade.g;sp.b2=shade.b;sp.cover=.85;sp.bias=size*.8;f.emit();
      return;
    }
    const s=Math.min(1.25,power);
    this.ink(s>=HARD&&Math.random()<.5?'burst2':'burst',x,y,z,mk*(.9+1.3*s),.24+.12*s,colour,edge??this.deep.copy(colour).multiplyScalar(.4),dx,dy,dz,1.6+.5*s);
  }
  /** A ball slammed into the floor (a kill, an ace): one barbed burst off the floor in the winners' colour,
   *  and - `dent` - what it leaves: a crack in the court for a minute, the colour hot in it at first, and a burn under a
   *  SUPER SHOT or an OVERDRIVE ball (`hot`). `big` about 0.7-1.4. (A two-second ink splash, two rings and
   *  dust along the floor, a ring of clouds, a column, a hit star with its lines and a shower of chips before; the
   *  engine's stone chips were tried too, and read as grey rocks on a wooden court.) */
  private slam(x:number,z:number,big:number,colour:THREE.Color,dent:boolean,hot:boolean){
    this.ink('burst2',x,.45,z,1.4+1.3*big,.32+.06*big,colour,this.deep.copy(colour).multiplyScalar(.4),0,0,0,1.8+.4*big);
    if(!dent)return;
    if(hot)this.scorch(x,z,1.5*big,colour);
    this.mark(MARK.crack,x,z,1.1+.9*big,colour,.55);
  }
  /** A blow flattens the ball along it for a breath: `amount` 0..1 of the whole squash; with no direction, along its
   *  flight. */
  private press(dx:number,dy:number,dz:number,amount:number){
    if(dx*dx+dy*dy+dz*dz>.25)this.pressAxis.set(dx,dy,dz).normalize();
    else if(this.velocity.lengthSq()>1)this.pressAxis.copy(this.velocity).normalize();
    this.pressAt=this.page;this.pressBy=Math.min(1,Math.max(.25,amount));
  }
  /** A power shot's path, begun: drawn behind the ball for SHAPE.strokeDraw seconds in `colour` (`dress`). */
  private path(colour:THREE.Color){this.strokeTrail.count=0;this.strokeLeft=SHAPE.strokeDraw;this.strokeColour.copy(colour);}

  // ---------------------------------------------------------------- a pitch that remembers

  /** A mark on the floor (vfx/GroundMarks): kept MARKS.life seconds, MARKS.most of them at a time by quality (the oldest
   *  gives way), none off the floor of play and none from a replay's frames. `tint` is its colour - the first glow of a
   *  crack or a burn, the lasting colour of a skid or a stamp - and `amount` how much of it. The floors of all six
   *  arenas are the plane at y = 0 with their lines painted in the floor's own shader, so a mark lies a hair over it (the
   *  pool's polygon offset) and has nothing to fight for depth. */
  private mark(kind:number,x:number,z:number,size:number,tint:THREE.Color,amount:number,rotation?:number){
    const R=this.mode==='sky-spike'?SPIKE_RULES:GOAL_RULES;
    if(this.replaying||Math.abs(x)>R.halfX+1||Math.abs(z)>R.halfZ+1)return;
    // (Neither sport's floor keeps marks. Football: no stamp where a goal was struck from, no ink skid of a dive or a
    // tackle, no burn - no green-black splash left in the box for a minute after a goal. Volleyball: no crack under
    // every kill, no skid under every dive, to build up into black scars across the planks; the slam's own burst still
    // answers the kill.)
    if(this.lastView?.football||this.lastView?.volley)return;
    // (Goal Rush's floor stops at its boards, past them is the concourse a hand lower: a mark laid by one is kept inside,
    // and in a goal's mouth inside its net.)
    if(this.mode==='goal-rush'){
      const in_=.3,end=Math.abs(x)<GOAL_RULES.goalHalfWidth-in_?GOAL_RULES.halfZ+GOAL_RULES.goalDepth-in_:GOAL_RULES.halfZ-in_;
      x=Math.max(-R.halfX+in_,Math.min(R.halfX-in_,x));z=Math.max(-end,Math.min(end,z));
    }
    this.marks.limit=MARKS.most[this.kit.quality];
    this.marks.mark(kind,x,0,z,0,1,0,size,this.page,MARKS.life,this.edge.copy(tint).getHex(),amount,rotation);
    this.marksUntil=this.page+MARKS.life;this.look.marks++;
  }
  /** A burn where a SUPER SHOT was struck from, or where it or an OVERDRIVE ball came down. */
  private scorch(x:number,z:number,size:number,colour:THREE.Color){this.mark(MARK.scorch,x,z,size,colour,1.2);}
  /** The skid a body leaves where it dives, slides or is knocked flat: laid ahead of it along the way it is moving (or
   *  along (dx, dz) when it is hardly moving), `long` metres either way. */
  private skid(id:string|null|undefined,dx:number,dz:number,long:number){
    const m=id?this.bodies.get(id):undefined;if(!m||this.page-m.skid<MARKS.skidGap)return;
    let vx=m.vx,vz=m.vz,v=Math.hypot(vx,vz);
    if(v<1.5){vx=dx;vz=dz;v=Math.hypot(vx,vz);if(v<.1)return;}
    vx/=v;vz/=v;m.skid=this.page;
    // (The mark's own x runs along the slide: GroundMarks lays x along (-sin, -cos) of its turn on the floor.)
    this.mark(MARK.skid,m.x+vx*long*.55,m.z+vz*long*.55,long,INK,0,Math.atan2(-vx,-vz));
  }
  /** Where a goal was struck from: the scorer's last blow on the ball among the match's events - one brush stroke round
   *  on the pitch there, the scorers' colour at its heart. */
  private struckFrom(view:BallView,e:BallEvent,colour:THREE.Color){
    for(let i=view.events.length-1;i>=0;i--){
      const s=view.events[i];
      if(s.at>e.at+1e-6||s.actorId!==e.actorId||s.kind!=='strike'&&s.kind!=='super')continue;
      if(e.at-s.at<8)this.mark(MARK.stamp,s.x,s.z,1.25,colour,1);
      return;
    }
  }
  private readonly shot=new THREE.Vector3();
  /** Which way a strike sent the ball (a unit vector; zero when the ball has since been touched by somebody else). */
  /** KICK_ARC: one kick's crescent, `power` 0 (a pass) to 1 (a full shot), along the ball's flight (else the
   *  kicker's facing to the ball). */
  private kickArc(view:BallView,e:BallEvent,power:number,team:THREE.Color){
    const d=this.shotDirection(view,e),K=KICK_ARC;
    let ux=d.x,uz=d.z;
    if(ux*ux+uz*uz<.01){const p=this.players.find(q=>q.id===e.actorId);if(!p)return;ux=e.x-p.x;uz=e.z-p.z;}
    const k=Math.hypot(ux,uz)||1;ux/=k;uz/=k;
    const quiet=this.quiet;this.quiet=1;
    const big=1/Math.max(.3,VFX.spriteSize),hot=K.heat/Math.max(.3,VFX.spriteGain);
    this.ink('slash',e.x-ux*K.back,K.y,e.z-uz*K.back,(K.size+K.power*power)*big,K.life+K.lifePower*power,WHITE,team,ux,.12,uz,hot);
    this.quiet=quiet;
  }
  private shotDirection(view:BallView,e:BallEvent){
    const b=view.ball,v=Math.hypot(b.vx,b.vy,b.vz);
    if(b.lastId!==e.actorId||v<1)return this.shot.set(0,0,0);
    return this.shot.set(b.vx/v,b.vy/v,b.vz/v);
  }
  // ---------------------------------------------------------------- the signature shots' motifs

  private readonly linkA=new THREE.Color();private readonly linkB=new THREE.Color();private linkSparks=0;private motifs=0;
  /** A seat's fighter, by its id (no allocation). */
  private fighterOf(view:BallView,id:string|null|undefined):FighterId|undefined{
    if(!id)return undefined;
    for(let i=0;i<view.seats.length;i++)if(view.seats[i].id===id)return view.seats[i].fighter;
    return undefined;
  }
  /** What a bespoke SUPER SHOT throws off in flight (superShotLooks.ts MOTIF_RATE), in its two colours. */
  private motif(m:NonNullable<ReturnType<typeof superLook>['motif']>,dt:number,r:number,a:THREE.Color,b:THREE.Color){
    const fx=this.fx,{x,y,z}=this.drawn,vx=this.velocity.x,vy=this.velocity.y,vz=this.velocity.z,speed=Math.max(1,this.velocity.length());
    this.motifs+=MOTIF_RATE[m]*dt*VFX.spriteGain;
    for(;this.motifs>=1;this.motifs--){
      const flip=Math.random()<.5,c=flip?a:b;
      switch(m){
        case 'sun':{
          // A corona: rings of gold and the ultimate's colour thrown out behind it, and a glint at its heart.
          fx.spawn(K.ring,x,y,z,vx*.15,vy*.15,vz*.15,.45,r*1.4,r*6.5,flip?GOLD:a,1);
          for(let i=0;i<4;i++){const d=this.randomDirection(9),o=fx.spawn(K.spark,x,y,z,d.x-vx*.1,d.y-vy*.1,d.z-vz*.1,.4,r*.3,r*.1,GOLD,1);fx.data[o+DRAG]=2;fx.data[o+STRETCH]=3;fx.data[o+FLAGS]=ALONG_FLIGHT;}
          break;
        }
        case 'foxfire':{
          // Flame wisps peeling off the rim and rising, fluttering.
          const off=this.rim(r*1.3),o=fx.spawn(K.smoke,x+off.x,y+off.y,z+off.z,-vx*.12+off.x*2,2.5+Math.random()*2,-vz*.12+off.z*2,.6+Math.random()*.3,r*.5,r*1.3,c,.9);
          fx.data[o+DRAG]=2.2;fx.data[o+GRAV]=-2;
          const p=fx.spawn(K.spark,x+off.x,y+off.y,z+off.z,-vx*.05,3+Math.random()*3,-vz*.05,.7,r*.3,r*.1,c,1);fx.data[p+FLAGS]=FLUTTER;fx.data[p+DRAG]=1.5;fx.data[p+SPIN]=(Math.random()-.5)*10;
          break;
        }
        case 'tide':{
          // Spray flung out to either side of its flight, falling as water does; a wake ring now and then.
          const sx=-vz/speed,sz=vx/speed,side=flip?1:-1,k=4+Math.random()*5;
          const o=fx.spawn(K.spark,x,y,z,sx*side*k-vx*.15,3+Math.random()*4,sz*side*k-vz*.15,.6,r*.22,r*.08,flip?WHITE:a,1);fx.data[o+GRAV]=12;fx.data[o+DRAG]=1;fx.data[o+STRETCH]=2.5;fx.data[o+FLAGS]=ALONG_FLIGHT;
          if(Math.random()<.12)fx.spawn(K.ring,x,y,z,0,0,0,.5,r*1.2,r*5,b,.8);
          break;
        }
        case 'sand-cut':{
          // Slash lines crossing over the ball, square to its flight, and sand puffing off.
          const ax=Math.random()-.5,ay=Math.random()-.5,az=Math.random()-.5,l=Math.hypot(ax,ay,az)||1,reach=r*(3+Math.random()*2);
          const o=fx.spawn(K.streak,x-ax/l*reach*.5,y-ay/l*reach*.5,z-az/l*reach*.5,vx*.4,vy*.4,vz*.4,.16,r*.18,r*.18,c,1);
          fx.data[o+FLAGS]=ALONG_AXIS;fx.data[o+AX]=ax/l;fx.data[o+AY]=ay/l;fx.data[o+AZ]=az/l;fx.data[o+STRETCH]=reach/(r*.18);
          this.puffs(x,y,z,1,DUST,.4,1.2,2);
          break;
        }
        case 'feast':{
          // A spiral of flame in its two colours round the flight.
          const t=this.time.value*14+this.motifs,sx=-vz/speed,sz=vx/speed,cx=Math.cos(t)*r*1.4,cy=Math.sin(t)*r*1.4;
          const o=fx.spawn(K.smoke,x+sx*cx,y+cy,z+sz*cx,-vx*.08,1.5,-vz*.08,.45,r*.45,r*1.1,c,.95);fx.data[o+DRAG]=3;fx.data[o+GRAV]=-3;
          break;
        }
        case 'crown':{
          // Golden lightning crawling round it, and gold glints.
          const ax=Math.random()-.5,ay=Math.random()-.5,az=Math.random()-.5,l=Math.hypot(ax,ay,az)||1,reach=r*(2+Math.random()*1.8);
          const o=fx.spawn(K.bolt,x+ax/l*reach*.6,y+ay/l*reach*.6,z+az/l*reach*.6,vx*.6,vy*.6,vz*.6,.1,r*.4,r*.4,flip?GOLD:a,1);
          fx.data[o+FLAGS]=ALONG_AXIS;fx.data[o+AX]=ax/l;fx.data[o+AY]=ay/l;fx.data[o+AZ]=az/l;fx.data[o+STRETCH]=reach/(r*.4)*.6;
          if(Math.random()<.2)fx.spawn(K.glint,x,y,z,0,0,0,.2,r*3,r,GOLD,1);
          break;
        }
        case 'sickle':{
          // Crescent ripples in the void's colour, left hanging behind it.
          fx.spawn(K.shield,x-vx*.03,y-vy*.03,z-vz*.03,0,0,0,.4,r*2,r*4.2,c,.85);
          fx.spawn(K.ring,x,y,z,0,0,0,.3,r*1.2,r*3.6,WHITE,.6);
          break;
        }
        case 'storm':{
          // Purple lightning thrown out round it, white streaks along its line.
          const ax=Math.random()-.5,ay=Math.random()-.5,az=Math.random()-.5,l=Math.hypot(ax,ay,az)||1,reach=r*(2.6+Math.random()*2.4);
          const o=fx.spawn(K.bolt,x+ax/l*reach*.6,y+ay/l*reach*.6,z+az/l*reach*.6,vx*.5,vy*.5,vz*.5,.09,r*.45,r*.45,flip?WHITE:a,1);
          fx.data[o+FLAGS]=ALONG_AXIS;fx.data[o+AX]=ax/l;fx.data[o+AY]=ay/l;fx.data[o+AZ]=az/l;fx.data[o+STRETCH]=reach/(r*.45)*.6;
          break;
        }
      }
    }
  }

  private readonly direction=new THREE.Vector3();
  private readonly spot=new THREE.Vector3();
  private readonly onHands=new THREE.Vector3();private readonly hand=new THREE.Vector3();
  /** How far the drawn ball is moved onto the hands of the body touching it now (MEET), at room time `now`. */
  private meet(view:BallView,now:number,camera:THREE.Camera){
    const out=this.onHands.set(0,0,0),takes=view.volley?.takes;
    this.overBody=false;
    if(!takes)return out;
    for(let i=0;i<this.players.length;i++){
      const p=this.players[i];
      if(p.action!=='heavy'||p.strike!=='tap')continue;
      const t=now-(p.actionStarted+SHOOT.contact);
      if(t<-SHOOT.contact||t>MEET.after)continue;
      const h=MEET.hands[takes[p.id]??''],at=h&&this.where(p.id,this.hand);
      if(!h||!at)continue;
      const dx=this.drawn.x-at.x,dz=this.drawn.z-at.z,d=Math.hypot(dx,dz)||1,size=p.size??1;
      at.x+=dx/d*h.fwd*size;at.z+=dz/d*h.fwd*size;at.y+=h.up*size;
      const ox=at.x-this.drawn.x,oy=at.y-this.drawn.y,oz=at.z-this.drawn.z;
      if(Math.hypot(ox,oy,oz)>MEET.most)continue;
      const w=t<0?smooth(t,-SHOOT.contact,0):1-smooth(t,0,MEET.after);
      // (The hands further from the lens than the body: the body would hide them - the ball is drawn over it.)
      const e=this.eye.setFromMatrixPosition(camera.matrixWorld);
      this.overBody=w>.25&&Math.hypot(at.x-e.x,at.z-e.z)>Math.hypot(at.x-dx/d*h.fwd*size-e.x,at.z-dz/d*h.fwd*size-e.z)+.1;
      return out.set(ox*w,oy*w,oz*w);
    }
    return out;
  }
  /** Where a seat's fighter stands: its drawn body, else the snapshot's place for it; null if neither. */
  private readonly where=(id:string,out:THREE.Vector3):THREE.Vector3|null=>{
    const drawn=this.bodyOf(id);if(drawn)return out.copy(drawn);
    for(let i=0;i<this.players.length;i++){const p=this.players[i];if(p.id===id)return p.alive?out.set(p.x,p.y,p.z):null;}
    return null;
  };
  /** A point `length` out from the ball's centre on the ring of its silhouette (square to the lens), a little behind it:
   *  what the ball throws off is seen round it, never over its face. */
  private rim(length:number){
    const d=this.randomDirection(1),vx=this.drawn.x-this.eye.x,vy=this.drawn.y-this.eye.y,vz=this.drawn.z-this.eye.z,l=Math.hypot(vx,vy,vz)||1;
    const along=(d.x*vx+d.y*vy+d.z*vz)/l;d.x-=vx/l*along;d.y-=vy/l*along;d.z-=vz/l*along;
    const k=length/(d.length()||1);return d.set(d.x*k+vx/l*length*.3,d.y*k+vy/l*length*.3,d.z*k+vz/l*length*.3);
  }
  private randomDirection(length:number){
    const u=Math.random()*2-1,a=Math.random()*Math.PI*2,s=Math.sqrt(1-u*u);
    return this.direction.set(Math.cos(a)*s*length,u*length,Math.sin(a)*s*length);
  }
}
