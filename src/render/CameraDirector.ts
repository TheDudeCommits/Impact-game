import * as THREE from 'three';
import {AWAKENINGS,AWAKENING_ENTRY,awakeningSwapAt,moveFor} from '../game/awakening';
import {awakenBeat,AWAKEN_BLEND_IN,AWAKEN_ORBIT_SHARE} from './awakenBeat';
import {CLOSE_SHOT} from './closeStyle';
import {loomTop} from './loomRegistry';
import {MOVES,RUSH_STAGES} from '../game/moves';
import {HIT_FOR,type PlayKind} from './CameraBrain';
import {TIME_STOP_TOURS} from '../game/timeStopBarrage';
import {rollerAt,ROLLER_TIMING} from './signature/Steamroller';
import type {Fighter} from './Fighter';
import type {CombatEvent,FighterId} from '../game/types';
import {LUCY_TIDE,tideColumn} from '../originals/lucyTide';

export type ShotKind='none'|'intro'|'victory'|'ultimate'|'awaken'|'ko'|'impact'|'opener';

const wrapped=(angle:number)=>Math.atan2(Math.sin(angle),Math.cos(angle));
const ease=(x:number)=>{const t=x<0?0:x>1?1:x;return t*t*t*(t*(t*6-15)+10);};
const blend=(rate:number,dt:number)=>1-Math.exp(-rate*dt);
/** max(a, b) with the corner rounded over `k`, so a distance that hands over
 *  from one limit to the other does not kink. */
const softMax=(a:number,b:number,k:number)=>(a+b+Math.sqrt((a-b)*(a-b)+k*k))/2;

/** The local player's ultimate opens on a low front three-quarter hero shot
 *  of the caster, pushing in from HERO_FROM to HERO_TO metres, HERO_ANGLE
 *  radians off the fighter's facing, the lens HERO_EYE below the chest
 *  looking up. It swings in over HERO_IN (never shorter than HERO_MIN in
 *  all) and hands on to the release shot (see HERO_HOLD); a hand-back cut
 *  short takes HERO_OUT at least, and the fallback's HERO_MAX.
 *
 *  The swings are the fastest thing the director does: 1.6-2.5 radians of
 *  orbit each way (the front is the body's, see `bodyFacing`, so the arc
 *  depends on the pose), which at these lengths peaks near 400-500 deg/s of
 *  aim for a moment. At 0.3 s they reached 630 in the probes and 870 in
 *  training, which strobes the background at sixty frames a second. */
const HERO_ANGLE=1.05,HERO_FROM=3.3,HERO_TO=2.7,HERO_EYE=-.45,HERO_LOOK=.25,HERO_FOV=42,HERO_IN=.58,HERO_OUT=.52,HERO_MIN=.8,HERO_MAX=1.45;
/** Round 3d (ULTS): a hit-confirm ultimate (MoveDefinition.confirm) is two
 *  things on screen. Its opener - out within half a second - is watched from
 *  the gameplay shot, pushed in: OPENER_PUSH of the way along the lens's own
 *  line to the caster (never nearer than OPENER_NEAREST, nor pushing in at
 *  all from nearer), the lens narrowed by OPENER_FOV, in over OPENER_IN, for
 *  as long as the opener is out (OPENER_MOST at the most) - so the player
 *  sees it land or miss. Its cinematic starts on the confirm (see
 *  `cinematic`): the release shot, or a time stop's field, carried on from
 *  wherever the lens is, then the impact shot as the finisher throws them. A
 *  whiff lets the push-in go over OPENER_OUT: the quick return. The close-up
 *  that opens the three-shot ultimate is left to the area ultimates, whose
 *  charge is the move. */
const OPENER_PUSH=.18,OPENER_NEAREST=2.4,OPENER_FOV=4,OPENER_IN=.2,OPENER_OUT=.28,OPENER_MOST=1.6;
/** When that framing's lens cannot see the caster - in training, Taisei's
 *  LAST SUN put KoKo's back across half the frame: the opponent stood
 *  on the line from the front three-quarter on the lens's side, which the shot
 *  took regardless - it tries the other side, then HERO_WIDE radians off the
 *  front (nearer the profile, which clears a body standing in front), then a
 *  lens HERO_HIGH over the chest looking down across whoever is in the way;
 *  each on the lens's own side first. See `hero`. */
const HERO_WIDE=1.55,HERO_HIGH=1.3;
type HeroFraming={angle:number;eye:number;from:number;to:number};
const HERO_FRAMINGS:readonly HeroFraming[]=[
  {angle:HERO_ANGLE,eye:HERO_EYE,from:HERO_FROM,to:HERO_TO},
  {angle:HERO_WIDE,eye:HERO_EYE,from:HERO_FROM,to:HERO_TO},
  {angle:HERO_ANGLE,eye:HERO_HIGH,from:HERO_FROM+.5,to:HERO_TO+.5},
];
/** The local player's ultimate is three shots, not one (both blind critics:
 *  the hero shot snapped back to the wide gameplay shot on the release, so
 *  the payoff played out small and far away).
 *
 *  A, the close-up: the hero shot above (or the charge framing below), held
 *  HERO_HOLD once it has swung in - less when the release comes sooner.
 *
 *  B, the release: over the caster's shoulder on the close-up's side,
 *  RELEASE_BEHIND off the line back from the victim (RELEASE_CLOSE more with
 *  the victim at arm's length, where the caster's own back would hide them),
 *  RELEASE_R out and RELEASE_EYE under the chest, looking along the
 *  diagonal from the caster to the victim with the victim RELEASE_X right
 *  of centre - the caster big in the near corner, the technique and the
 *  victim across the frame. The field is
 *  fitted, RELEASE_FOV to RELEASE_FOV_MOST, to hold - under RELEASE_TOP of
 *  the half-height (the HUD's bars) and the victim's feet over RELEASE_FEET
 *  (the skill cards) - the
 *  caster's head, the victim crown to feet and a charge overhead; past that
 *  the lens stands back, to RELEASE_REACH (RELEASE_REACH_CHARGE under a
 *  charge overhead, whose centre must show and whose top may crop; the room
 *  behind the caster always limits it). It follows the victim at the hero
 *  bearing's own turn limits. The swing from A is timed by its travel, and B
 *  holds through the release and the technique's flight; with no impact by
 *  RELEASE_LINGER after it was due, it hands back to the gameplay shot. With
 *  nobody to hit, the diagonal runs RELEASE_AHEAD metres along the caster's
 *  front. */
const HERO_HOLD=.7,HERO_HOLD_LEAST=.35,RELEASE_BEHIND=.85,RELEASE_CLOSE=.25,RELEASE_R=1.9,RELEASE_EYE=.3,RELEASE_X=.3,RELEASE_FOV=52,RELEASE_FOV_MOST=68,RELEASE_REACH=4.5,RELEASE_REACH_CHARGE=6,RELEASE_TURN=.15,RELEASE_WIDEST=1.5,RELEASE_LINGER=.4,RELEASE_AHEAD=6,RELEASE_HOLD_LEAST=.4,RELEASE_TOP=.6,RELEASE_FEET=.45;
/** The swing from the close-up to the release shot turns the aim through
 *  the orbit and the change of what it looks at together - three radians and
 *  more - so it also takes long enough for the aim never to pass AIM_SPEED
 *  (rad/s) at the ease's peak. */
const AIM_SPEED=6.5;
/** Round 3b: the swing from the close-up to the release goes the long way
 *  round when the short way passes within SWING_CLEAR metres of a body. */
const SWING_CLEAR=1.1;
/** C, the impact: the finishing hit of the local player's ultimate carries
 *  the shot onto the victim - a front three-quarter IMPACT_ANGLE off the line
 *  back to the caster, on the side the lens is already on (or the other, if
 *  somebody stands in the way), IMPACT_R out and IMPACT_EYE over the chest -
 *  and follows them as they are thrown, IMPACT_HOLD on the aftermath once
 *  the carry from the release shot (at least IMPACT_CARRY: the victim is
 *  thrown metres meanwhile) has settled, then hands back over at least
 *  IMPACT_OUT, timed by its travel. With nothing on screen to carry from, it
 *  swings in over at least IMPACT_IN, timed the same way. Only within
 *  IMPACT_RANGE. */
const IMPACT_ANGLE=1.15,IMPACT_WIDE=1.6,IMPACT_R=3.4,IMPACT_EYE=.3,IMPACT_FOV=48,IMPACT_HOLD=.45,IMPACT_OUT=.6,IMPACT_IN=.3,IMPACT_CARRY=.9,IMPACT_RANGE=24;
/** Round 3 (TIMESTOP): HUSH, MIDNIGHT and PLANETARIUM are a tour of a
 *  stopped field - the user crosses it to each opponent the stop caught
 *  (src/game/timeStopBarrage.ts) - so after the close-up their second shot is
 *  not the release over the shoulder but the field itself: the lens craned
 *  FIELD_EYE of its reach above the floor on the side it already stands, FIELD_R
 *  metres out plus FIELD_SPREAD of the field's own spread from its centre,
 *  never nearer than FIELD_NEAREST, looking at the field's centre pulled
 *  FIELD_TOWARD of the way to the user - the establishing shot of everybody
 *  frozen, which then tracks him from victim to victim as that centre moves
 *  with him (eased at FIELD_EASE), drifting FIELD_DRIFT rad/s round and
 *  pushing in by FIELD_PUSH over the tour. The field is fitted into the
 *  frame: FIELD_FOV at least, FIELD_FOV_MOST at most, standing back past
 *  that. The close-up gives way as the clock stops (holding TOUR_HOLD_LEAST
 *  at least), and the swing to the field takes TOUR_SWING at most, timed by
 *  the aim. With more than one caught it holds through the resume - every
 *  victim blasted at once is the shot - for TOUR_LINGER after the finisher;
 *  one alone gets the impact shot, as any ultimate's victim does. */
const WORLD_UP=new THREE.Vector3(0,1,0);
const FIELD_R=3.6,FIELD_SPREAD=.85,FIELD_NEAREST=4.4,FIELD_EYE=.52,FIELD_TOWARD=.4,FIELD_EASE=5,FIELD_DRIFT=.1,FIELD_PUSH=.14,FIELD_FOV=48,FIELD_FOV_MOST=68,FIELD_REACH=13,FIELD_MARGIN=.84,TOUR_LINGER=.85,TOUR_SWING=.75,TOUR_HOLD_LEAST=.2;
/** The steamroller's top over its own base (its roof, 2.15 m of its model
 *  drawn 1.5x: signature/Steamroller), and how long the field takes to open
 *  for it once it comes into the stop. */
const ROLLER_TOP=3.25,ROLLER_EASE=.45;
/** An ultimate whose charge gathers over the caster (the move data's
 *  `style==='bomb'`, the same test CombatEffects places the core by) is
 *  framed to hold the technique as well as the body: the lens widens to
 *  CHARGE_FOV and stands back - never nearer than HERO_FROM, never further
 *  than CHARGE_REACH - until the caster's feet and CHARGE_TOP of the charge's
 *  radius over its centre fit, with CHARGE_TOP_EDGE of the field to spare
 *  above and CHARGE_FOOT_EDGE below (the HUD's key strip), looking up through
 *  the middle. So the lens cranes back as the charge grows. A room too small
 *  for that - the Proving Hall is 13 m across, and the wall pull-in held the lens
 *  a metre short, which dropped the caster's feet under the HUD - keeps the
 *  lens inside it and widens it instead, up to CHARGE_FOV_MOST; past that the
 *  top of the charge is cropped, never the caster. The side with more room
 *  for CHARGE_ROOM metres is taken first: of the framings that see the
 *  caster, the first with that much room, else the roomiest (a clean swing in
 *  counting SWING_ROOM metres). It is the close-up of a charge ultimate;
 *  the release shot then holds the charge with the victim. */
const CHARGE_FOV=56,CHARGE_FOV_MOST=62,CHARGE_TOP=.85,CHARGE_TOP_EDGE=.05,CHARGE_FOOT_EDGE=.12,CHARGE_REACH=8,CHARGE_ROOM=6,SWING_ROOM=.5;
/** That lens stands metres further out than the close shot's, so the same
 *  swing round the caster is metres more travel: 0.62 m a frame on the way in
 *  at the close shot's timing. Its swings - in, back, and a hand-back cut
 *  short - are timed by the travel instead: never faster than LENS_SPEED
 *  metres a second at the ease's peak (1.875 times the mean), never shorter
 *  than the close shot's, never longer than SWING_LONGEST. */
const LENS_SPEED=24,SWING_LONGEST=1.4;
/** Where that charge is, as CombatEffects draws it: SPIRIT_HEIGHT and
 *  SPIRIT_RADIUS for Taisei's LAST SUN, SUN_HEIGHT and SUN_RADIUS for Kagari's
 *  sun, 2.8 m and 2 m for any other bomb, each growing from `from` of its
 *  radius as charge^power; Konta's sphere (KONTA_BOMB) a hand's breadth over
 *  his raised hands, Kurobi's at its mouth - both read off the rig through
 *  `chargePosition`, as CombatEffects reads them. Those constants are private
 *  to CombatEffects, so they are repeated here; keep the two in step. */
const OVERHEAD:Partial<Record<FighterId,{height:number;radius:number;power:number;from:number}>>={taisei:{height:4.65,radius:2.3,power:.8,from:.14},kagari:{height:3.6,radius:2.2,power:.7,from:.12}};
const BOMB={height:2.8,radius:2,power:.8,from:.14},KONTA_BOMB=1.45;
/** The awakening entry (the 0.9 s invulnerable transformation): from wherever
 *  the gameplay shot is, orbit AWAKEN_ORBIT radians toward the fighter's front
 *  while pushing in by AWAKEN_PUSH of the distance and narrowing the lens by
 *  AWAKEN_FOV degrees, then hand back over AWAKEN_OUT. */
const AWAKEN_ORBIT=1.1,AWAKEN_PUSH=.28,AWAKEN_FOV=5,AWAKEN_IN=.35,AWAKEN_OUT=.6;
/** A coat can completely hide an entry's hand/chest acting from gameplay's
 * rear lens. These entries establish a front three-quarter shot, then use
 * the same head fit, wall clearance, burst and hand-back as the roster. */
const FRONT_AWAKEN:ReadonlySet<FighterId>=new Set<FighterId>(['ampere','pyroclast','full-beam','shakugo','kuzu','tancho','bellows','mikage','akaito','shijima','tempo','oyashio','adad','senko','buna','suzuran','wataame','kusushi','hakushi','sashigane','gosu','barrow','unari','strappado','ume','lanthorn','highsun','torsion','kubiwa','onigawara','minase','shakudo','amagoi','hinomoto','shidare','irbis','rakucho','shibuichi','mizuhiki','hisame','hagure','akayuri','madake','kinu','murex','bonsho','rotfalke','hawser','ovid','psyche','hikui','tokan']);
const FRONT_AWAKEN_IN=.45,FRONT_AWAKEN_ANGLE=.75;
/** Round 3e (CAM4): the awakening from a clear bearing. Training's reset
 *  stands the fighter half a metre from the hall's wall, the gameplay lens
 *  already inside the wall's volume; the entry began there, and the wall
 *  check in `present` pulled it to its 1 m minimum over the fighter's head for
 *  the whole entry (MODELS2 measured it; the third blind critic read it as a
 *  transformation with no camera beat). So the shot starts from the nearest
 *  bearing - searched AWAKEN_STEP at a time out to AWAKEN_SEARCH either way,
 *  the fighter's front side first - from which AWAKEN_ROOM of its reach is
 *  clear both where it starts and where its orbit ends, swinging to it no
 *  faster than AIM_SPEED at the blend's peak (the aim turns AWAKEN_AIM times
 *  as far as the swing: the beat's own orbit and the look's change from the
 *  gameplay heading to the fighter ride on it). With none that clear (a corner), it keeps its own reach
 *  behind the wall rather than a metre over the head. Either way the shot
 *  that began behind a wall leaves the wall to the stage fade (StageFade cuts
 *  a wall the lens stands behind): pulled in as it swung past the wall's
 *  edge, the lens dipped to 1.7 m and back and the aim whipped at 760 deg/s.
 *  The beat (awakenBeat) keeps its own clock throughout. */
const AWAKEN_STEP=.1,AWAKEN_SEARCH=1.6,AWAKEN_ROOM=.9,AWAKEN_AIM=2.2;
/** Round 3f (CAM5): the awakening framed on the fighter as drawn, not on a
 *  point over their root. The fourth blind critic, in all sixteen harness
 *  awakenings in the Proving Hall: "the frame about 300 ms after pressing E is a
 *  wall", the head under the skill cards or at the frame's edge for up to
 *  397 ms, jumping up to 0.32 of the screen in a frame. Measured the same way
 *  (scripts/capture_awaken_frame.mjs, every frame), three causes:
 *
 *  - the shot looked at a fixed point 1.5 m over the root while the power-up
 *    crouches the body (Taisei's head at 1.16 m), lunges it (Gaunt' head two
 *    metres off his root) or bows it, and the lens zooms twelve degrees in;
 *  - its look was lerped from the gameplay look - out ahead of the player, at
 *    the opponent - to that point while the lens swung round the fighter, which
 *    carried the head across the frame and down under the cards, leaving the
 *    far wall (the critic's wall frame);
 *  - the predicted entry reads awaken, idle for a few frames, then awaken again
 *    as the server's word arrives, and the shot was ended and started afresh:
 *    a second blend, and on the hosted build a second kick.
 *
 *  So the shot is aimed every frame, from wherever its lens is, to put the head
 *  as drawn - its own, a form's, raised to its own height when a form's is
 *  lower (Kurobi prowls) and halfway to a looming spirit's crown (eased at
 *  AWAKEN_EXCESS_RATE, and set AWAKEN_TALL lower on the screen by the time
 *  the spirit stands AWAKEN_TALL_AT over the head, so it has room), followed on a
 *  critically damped spring AWAKEN_TRACK seconds slow and no faster than
 *  AWAKEN_TRACK_MOST metres a second, so a straining or snapping pose does not
 *  shake the picture, and never further than AWAKEN_REACH from the root, so a
 *  power-up that lunges is watched from where the fighter stands - at a point
 *  on the screen: where the gameplay shot
 *  had it, moving along a straight line to AWAKEN_AT (left of the middle,
 *  under the bars, clear of the cards) as the shot takes the frame, and back
 *  as it hands it over; the blend in takes long enough for that line never to
 *  be crossed faster than AWAKEN_HEAD_SPEED of the screen a second at the
 *  ease's peak. The lens is widened - no further than AWAKEN_FOV_MOST, and
 *  no faster than AWAKEN_WIDEN_RATE degrees a second either way - as far as it takes to
 *  hold the crown under AWAKEN_TOP and the body (its root raised a metre,
 *  where the critic measured it) over AWAKEN_FLOOR, or over AWAKEN_CARDS in
 *  the cards' column (from AWAKEN_FINE_LINE across). From the
 *  burst a form is stood back from by its size (bodyBulk, or its crown over a
 *  body's CROWN_HEIGHT - that from the first frame it shows, eased at
 *  AWAKEN_SIZE_RATE), the lens AWAKEN_SIZE_LIFT higher for each unit of it. A form that stands in for the body (Full
 *  Swell's head 0.9 m higher, Kurobi's 1.4 m ahead) is framed from
 *  AWAKEN_FORM_LEAD before the swap to AWAKEN_FORM_LAG after it, the point
 *  framed and the stand-back going over to it - its head found under the
 *  fighter while it is still hidden, in its rest pose - so it arrives framed
 *  rather than under the bars for a third of a second. And an entry the
 *  presented state drops for less than AWAKEN_GRACE keeps its shot, whose
 *  beat only ever runs forward - and catches up with a presented clock that
 *  leaps (measured: 33 ms of entry in a 13 ms frame, the lens thrown 0.9 m)
 *  at no more than AWAKEN_CATCH times its own pace. */
const AWAKEN_AT_X=-.15,AWAKEN_AT_Y=.2,AWAKEN_TRACK=.09,AWAKEN_TRACK_MOST=3,AWAKEN_REACH=.9,AWAKEN_HEAD_SPEED=1.6,AWAKEN_FOV_MOST=64;
const AWAKEN_TOP=.52,AWAKEN_FLOOR=-.66,AWAKEN_CARDS=-.36,AWAKEN_FINE_LINE=[-.08,.1] as const;
const AWAKEN_CROWN=.24,AWAKEN_CROWN_MOST=1.2,CROWN_HEIGHT=1.95,AWAKEN_SIZE_RATE=8,AWAKEN_SIZE_LIFT=.8,AWAKEN_SIZE_MOST=1.9,AWAKEN_GRACE=.25,AWAKEN_WIDEN_RATE=150,AWAKEN_FORM_LEAD=.3,AWAKEN_FORM_LAG=.08;
const AWAKEN_TALL=.22,AWAKEN_TALL_AT=.8,AWAKEN_EXCESS_RATE=8,AWAKEN_CATCH=2;
/** A looming spirit's crown over the neck loomRegistry gives: FollowCamera's
 *  STAND_CROWN, repeated so the director does not import the rig. */
const AWAKEN_STAND_CROWN=.45;
/** A standing head's height over the root, for the crown's reckoning. */
const AWAKEN_STANDING=1.6;

/** Where `point` falls on the screen of a lens at `eye` looking at `look` with
 *  a field whose half-height and half-width tangents are `tanV`, `tanH`, into
 *  `out` (normalised device coordinates, no roll: three's lookAt); false when
 *  it is behind the lens. */
function screenOf(point:THREE.Vector3,eye:THREE.Vector3,look:THREE.Vector3,tanV:number,tanH:number,out:{x:number;y:number}){
  let fx=look.x-eye.x,fy=look.y-eye.y,fz=look.z-eye.z;const fl=Math.hypot(fx,fy,fz);
  if(!(fl>1e-9))return false;fx/=fl;fy/=fl;fz/=fl;
  let rx=-fz,rz=fx;const rl=Math.hypot(rx,rz);
  if(!(rl>1e-9))return false;rx/=rl;rz/=rl;
  const dx=point.x-eye.x,dy=point.y-eye.y,dz=point.z-eye.z,depth=dx*fx+dy*fy+dz*fz;
  if(!(depth>1e-6))return false;
  out.x=(dx*rx+dz*rz)/depth/tanH;out.y=(-dx*rz*fy+dy*(rz*fx-rx*fz)+dz*rx*fy)/depth/tanV;
  return true;
}
/** The look point, `point`'s own distance out, of the lens at `eye` that puts
 *  `point` at (x, y) on its screen (see screenOf) with no roll, into `out`:
 *  the pitch from the height it must stand at, the heading from the side. */
export function aimAt(eye:THREE.Vector3,point:THREE.Vector3,x:number,y:number,tanV:number,tanH:number,out:THREE.Vector3){
  const dx=point.x-eye.x,dy=point.y-eye.y,dz=point.z-eye.z,d=Math.hypot(dx,dy,dz);
  if(!(d>1e-6))return out.copy(point);
  const a=x*tanH,b=y*tanV,n=Math.sqrt(1+a*a+b*b);
  const pitch=Math.asin(THREE.MathUtils.clamp(dy/d*n/Math.sqrt(1+b*b),-1,1))-Math.atan(b);
  const heading=Math.atan2(dx,dz)+Math.atan2(a,Math.cos(pitch)-b*Math.sin(pitch));
  return out.set(eye.x+Math.sin(heading)*Math.cos(pitch)*d,eye.y+Math.sin(pitch)*d,eye.z+Math.cos(heading)*Math.cos(pitch)*d);
}
/** The local player's KO: a push along the line the lens already has to the
 *  victim, KO_PUSH of the way in (never nearer than KO_NEAREST), the lens
 *  narrowed by KO_FOV. Skipped past KO_RANGE: a push across the arena is not
 *  a push. It keeps most of the gameplay lens's height, which clears heads -
 *  unless the view is pitched up, when a bystander on the line had the push
 *  end inside them; so it stops with KO_CLEAR of air round anybody standing on
 *  the line, the stop fading out over KO_FADE to either side of it. */
const KO_PUSH=.4,KO_NEAREST=2.4,KO_FOV=6,KO_IN=.25,KO_HOLD=.35,KO_OUT=.35,KO_RANGE=18,KO_CLEAR=1.1,KO_FADE=1.2;
/** The countdown: the last INTRO_SWEEP seconds of it open on a wide front
 *  shot of the player, drift round, and sweep back onto the gameplay shot,
 *  arriving exactly as the countdown ends. */
const INTRO_SWEEP=3.2,INTRO_FRONT=.35,INTRO_RADIUS=5,INTRO_FOV=46,INTRO_IN=1,INTRO_LEAVE=.45,INTRO_ABORT=.9;
/** How long a shot takes to hand back when it is ended early - by a hit or by
 *  the player turning the view: the same order as the scripted swings, since
 *  the lens may be on the far side of the fighter. */
const INTERRUPT=.4;
/** Round 4b (TARGETING): the local player's blows are one string while each lands within this many seconds of the last. */
const STRING_GAP=.9;
/** The winner: a low three-quarter orbit, VICTORY_ANGLE off their facing and
 *  drifting round, eased in (or cut, from further than VICTORY_CUT) and out. */
const VICTORY_ANGLE=.55,VICTORY_RADIUS=3.6,VICTORY_EYE=-.35,VICTORY_FOV=44,VICTORY_IN=.9,VICTORY_OUT=1,VICTORY_CUT=14;
/** The feel pass, iteration fifteen: the victory poses reach well above the head (a fist thrown up, a sword
 *  over the shoulder), and where a wall pulls the lens in - the Proving Hall, where duels end - the raised fist went under
 *  the HUD's top plates for the whole six seconds. The shot widens to hold the head and both hands within VICTORY_FILL
 *  of its half-field, from wherever the lens ended up, eased (the hold breathes), up to VICTORY_FOV_MOST; in the open
 *  it stays at VICTORY_FOV. */
const VICTORY_FIT=['Head','LeftHand','RightHand'] as const,VICTORY_FILL=.78,VICTORY_FOV_MOST=66;
/** The finale (10 October 2026; src/ui/results/finale.ts holds the results for this shot): a duel mostly ends against
 *  the ring's edge, the winner facing out of it, and both of the orbit's sides lay outside the walls - the lens was
 *  pulled in to MIN_REACH over the winner's shoulder for the whole pose. With both sides walled (less than VICTORY_ROOM
 *  of the orbit's reach clear anywhere along it), the orbit turns round the winner by the first of VICTORY_TURNS that
 *  is clear - nearer their front first, then further round, toward the room - or the clearest of them. In the open, or
 *  with one side clear, it is the orbit it always was. */
const VICTORY_ROOM=.85,VICTORY_TURNS=[-.3,-.55,.4,.8,1.2,1.6,2] as const;
/** Walls: the lens keeps CLEARANCE metres of air in front of any occluder
 *  between it and the subject, and never closes in nearer than MIN_REACH. */
const CLEARANCE=.35,MIN_REACH=1;
/** Bodies. Each fighter is a vertical capsule BODY_RADIUS round an axis
 *  spanning BODY_HEIGHT over its feet (both times its bulk, see `bodyBulk`);
 *  a body on the floor is a CORPSE_RADIUS ball. A sight line needs SIGHT_CLEAR
 *  of air past a capsule. A body is taken to be where its velocity carries it
 *  by then, for at most PREDICT seconds. A hero shot whose lens loses the
 *  caster behind somebody for BLOCKED_GRACE seconds hands back.
 *
 *  The shots are placed and their sides chosen so their lenses pass nobody,
 *  and as a last resort a lens that would still come within LENS_CLEAR of a
 *  body cranes over its head instead, the lift fading in over LIFT_FADE
 *  metres either side: a lens pushed out sideways flips from one side of a
 *  body to the other in a frame when its path crosses the middle (measured:
 *  0.97 m), and a lift has no sides. */
const BODY_RADIUS=.42,BODY_HEIGHT=1.85,CORPSE_RADIUS=.9,SIGHT_CLEAR=.1,LENS_CLEAR=.3,LIFT_FADE=1.5,PREDICT=.6,BLOCKED_GRACE=.15;
/** A swing is sampled SWING_SAMPLES times between its ends: often enough that
 *  a body standing on the arc is found, which five samples missed once the
 *  lock-on lens came in close (the countdown sweep went over the opponent's
 *  head 0.19 m clear, lifted there by the keep-out). */
const SWING_SAMPLES=12;
/** What the impact shot fits in its field: the crown (over the head joint)
 *  and the feet. */
const FIT_JOINTS=['Head','LeftFoot','RightFoot','LeftToeBase','RightToeBase'] as const;
/** The victim of an ultimate is thrown five metres and more, and the hall is
 *  thirteen across: the impact shot's lens, kept at one bearing round them,
 *  was carried into the wall they flew at, where the pull-in snapped it a
 *  metre a frame along the wall (1734 deg/s of aim on probe_shot_knockback's
 *  LAST SUN) and left it filming the wall with the victim's legs at the
 *  bottom of the frame. So its bearing is steered, the way the release
 *  shot's is: where the victim is headed within IMPACT_AHEAD seconds (no
 *  further than IMPACT_AHEAD_MOST metres), the wall must leave IMPACT_ROOM of
 *  the lens's reach clear, and while it does not the bearing turns - at
 *  TURN_SPEED, braking at TURN_ACCEL - to the nearest one that does, searched
 *  IMPACT_STEP at a time out to IMPACT_SEARCH either way, among those that
 *  see the victim past everybody else. It looks at the body as drawn, eased
 *  at IMPACT_DRAWN (a launch clip throws the chest a metre from the root the
 *  shot used to aim at), and the lens widens - to IMPACT_FOV_MOST at most -
 *  until the whole body fits inside IMPACT_FILL of the frame. */
const IMPACT_AHEAD=.35,IMPACT_AHEAD_MOST=2.2,IMPACT_ROOM=1,IMPACT_STEP=.15,IMPACT_SEARCH=1.8,IMPACT_DRAWN=10,IMPACT_FOV_MOST=64,IMPACT_FILL=.72;
/** Room is measured down the bearing and IMPACT_CONE radians either side of
 *  it: a bearing that runs along a wall a few centimetres off it has the
 *  whole reach clear straight ahead and puts the lens in the wall anyway.
 *  On the frame the blow lands the victim has not started moving, so where
 *  they are headed is taken to be IMPACT_THROW metres on from the caster.
 *  And where the room runs out regardless - a corner - the lens is pulled in
 *  at IMPACT_PULL rather than in one frame, which was a cut. */
const IMPACT_CONE=.22,IMPACT_THROW=2.5,IMPACT_PULL=16;
/** The impact bearing's turn is eased in (see turnImpact): a third of its
 *  acceleration at first, all of it by IMPACT_EASE seconds into the shot. */
const IMPACT_EASE=.35,IMPACT_EASE_FLOOR=.35;
/** The hero shot's lens follows the body's front as the clip turns it (Kagari's
 *  ultimate swings the torso 63 degrees in its first 0.8 s), and a turn can carry
 *  it round behind the opponent. So its bearing round the caster is a state
 *  of its own: it follows the front, but never onto a bearing from which the
 *  caster is hidden - checked every TURN_STEP of the way - and waits at the
 *  edge of the clear stretch instead. If somebody walks into the line, it
 *  slides to the nearest clear bearing, searched out to TURN_SEARCH either
 *  way. It turns no faster than TURN_SPEED radians a second (nor TURN_REACH
 *  metres a second of lens travel on a wide shot), braking at TURN_ACCEL.
 *  With nothing clear in reach it hands back (BLOCKED_GRACE). */
const TURN_STEP=.12,TURN_SEARCH=1.3,TURN_SPEED=2.5,TURN_REACH=8,TURN_ACCEL=10,TURN_GAIN=8;
/** The close shot's swings are timed for up to SWING radians round the
 *  caster, which is what the lock-on lens makes (about 1.1 from its shoulder
 *  view). A longer one - the free camera starts right behind the player, 2.1
 *  radians from the front three-quarter, as does a lock-on lens with the
 *  opponent behind the caster; a lens that followed a body the clip turned
 *  ends further round - takes proportionally longer, up to SWING_MOST times,
 *  so the aim turns no faster: those peaked at 630 deg/s, the strobing the
 *  timings above were chosen to stop. The shot runs on by as much as its
 *  swings grew, so the hold is not eaten - never past the release. */
const SWING=1.4,SWING_MOST=1.6;
/** A shot that starts over another sheds the difference over CARRY seconds,
 *  eased at both ends: an exponential decay starts at full speed, which is a
 *  kink in the motion on the very frame the new shot begins. */
const CARRY=.5;
/** The most a shot's own clock advances in one frame. A cast or a
 *  transformation is exactly when a frame is likely to run long (measured in
 *  training: 50-160 ms as the effects start), and a swing sampled across a
 *  160 ms frame is a cut. So a slow frame slows the shot instead of jumping
 *  it; only the countdown sweep keeps real time, since it has to land on the
 *  countdown's end. */
const SHOT_STEP=1/30;

/** Round 3b (CAMERA). An ultimate's shot should always frame the caster and
 *  the victim with nothing in the way; the blind critic found ours sitting behind the victim, next to a bystander's torso
 *  and inside what the move summons. So every ultimate shot is checked
 *  against the whole crowd and against the summons below:
 *
 *  - a body the shot is not about may not fill more than CROWD_MOST of the
 *    frame from in front of its subjects (a bystander at the lens, or the
 *    victim looming over the caster's close-up): the shot takes the framing,
 *    side or bearing that keeps them out, and the occlusion fade (see
 *    OcclusionFade) thins whatever is left;
 *  - the release shot sees the victim as well as the caster, past bodies and
 *    summons, and keeps RELEASE_ROOM (times their bulk) back from the victim,
 *    searching round from over the shoulder RELEASE_TURN at a time out to
 *    RELEASE_SEARCH, on its own side first and then the other;
 *  - no lens stands inside a summon or within SUMMON_CLEAR of it; the
 *    release shot stands back from one SUMMON_STEP at a time until it has
 *    SUMMON_STAND of air, so what was summoned is seen whole rather than as
 *    a dark wall across the lens.
 */
const CROWD_MOST=.12,RELEASE_SEARCH=2.45,RELEASE_ROOM=2.3,SUMMON_CLEAR=.55,SUMMON_STAND=1.3,SUMMON_STEP=.4,RESEARCH=.25;
/** Round 3d (ULTS): nor does the release shot stand within BYSTANDER_CLEAR
 *  metres, across the floor, of anybody else on their feet - a lens at a
 *  bystander's ear. The three-shot ultimate kept off one at the caster's
 *  shoulder only by way of the side its close-up had taken; a hit-confirm
 *  cinematic has no close-up and starts on the gameplay lens's own side. */
const BYSTANDER_CLEAR=1.25;
/** The summons, where the effect layers draw them. Their constants are
 *  private to those layers, so they are repeated here: keep them in step.
 *  Ikazuchi Arrow's Guardian (NinjaEffects): GUARDIAN_BACK behind the unawakened
 *  caster along his facing, GUARDIAN_HEIGHT tall and GUARDIAN_RADIUS round its
 *  body (measured in the client: 4.2 m tall, 2.8 m across the shoulders), up
 *  for GUARDIAN_FOR seconds. The GRAND TIDE's fist (GummyEffects, GiantFist; round
 *  4b): hung knuckles down GRAND_TIDE_OVER over the held victim's head from
 *  GRAND_TIDE_FROM, blown up to GRAND_TIDE_BIG times the Taimatsu fist (GRAND_TIDE_SMALL
 *  first), a capsule GRAND_TIDE_BODY of that round and GRAND_TIDE_TALL of it tall; it
 *  is driven down onto them from GRAND_TIDE_DRIVE, when it stops being anything
 *  but the blow. Banquet Infernal (GummyEffects): Kosho burning,
 *  HELL_RADIUS round and HELL_HEIGHT tall. And Kurobi's own body (FOX_BODY)
 *  for the Kitsunebi-Dama it throws. */
// Round 3d (ULTS): read off the moves rather than repeated - the Guardian is
// up for Ikazuchi Arrow's length, and the GRAND TIDE is the finisher of a
// hit-confirm ultimate: its fist inflates over the held victim from just
// after the opener and is driven down over the last 0.24 s (GummyEffects).
const GRAND_TIDE_AT=MOVES.gummy.ultimate.contacts[MOVES.gummy.ultimate.contacts.length-1];
const GUARDIAN_BACK=.35,GUARDIAN_HEIGHT=4.3,GUARDIAN_RADIUS=1.35,GUARDIAN_FOR=MOVES.shiden.ultimate.duration;
const GRAND_TIDE_FROM=MOVES.gummy.ultimate.contacts[0]+.3,GRAND_TIDE_DRIVE=GRAND_TIDE_AT-.24,GRAND_TIDE_SMALL=.35,GRAND_TIDE_BIG=2,GRAND_TIDE_OVER=.08,GRAND_TIDE_BODY=.75,GRAND_TIDE_TALL=1.8;
const HELL_RADIUS=.8,HELL_HEIGHT=2.3;
/** Kurobi (awakened Konta's form, formForward -3.2 and 1.8x): 3 m tall, its
 *  body reaching some 4.5 m behind the root before the tails (measured in the
 *  client), taken as FOX_RADIUS capsules FOX_BODY metres back. */
const FOX_BODY=[.9,2.9] as const,FOX_RADIUS=1.35,FOX_TOP=3.1;
/** Round 3c (CAM3): the caster as drawn. The second blind critic: "The lens
 *  sits inside Ward's coat for about 2 s, and Gaunt' cape fills most frames."
 *  Measured in training (scripts/capture_camera_r3c.mjs), the release and
 *  impact lenses came within 0.23-0.52 m of Ward's drawn coat for two seconds,
 *  Gaunt' cape hid 23-49% of the victim through the swing and the release, and
 *  Kurobi's close-up stood 0.44 m from the fox's body. To the shots above a
 *  body is a capsule (BODY_RADIUS), and a coat's tails, a cape's hem or a fox
 *  reach well past one. So through the local player's ultimate and its impact
 *  the caster is sampled as drawn - CASTER_POINTS of the vertices of what it
 *  shows, skinned as posed, every CASTER_EVERY seconds - and
 *  - the lens keeps CASTER_CLEAR of air round all of them: pushed out across
 *    the floor, away from the caster's root, by as much as that takes (never
 *    more than CASTER_PUSH_MOST), taken up at CASTER_IN and let go at
 *    CASTER_OUT, so a coat that flaps does not shake the shot;
 *  - the release shot sees the victim past them: a sight line that passes
 *    within CASTER_SIGHT of more than CASTER_HIDES of them is hidden, and the
 *    bearing search goes on round to one that is not. */
const CASTER_POINTS=480,CASTER_EVERY=.1,CASTER_CLEAR=1,CASTER_PUSH_MOST=3,CASTER_IN=20,CASTER_OUT=3,CASTER_SIGHT=.14,CASTER_HIDES=4;
/** Round 3c: the sight lines to the victim the fade is told about (heights
 *  over their feet, times their bulk), and how long it is kept told. */
const HIDDEN_LINES=[.6,1.1,1.62] as const,HIDDEN_HOLD=.35;
/** Round 3c: how the local player's ultimate ends. Every finisher throws its
 *  victim about 3.8 m up (measured on all sixteen), and the impact shot rose
 *  with them, its lens 4.4-5.6 m over the floor at the top of the arc - the
 *  critic's "Shirokane's ultimate ends on the ceiling". The lens now stays under
 *  IMPACT_TOP over the floor they left, and looks up at them no steeper than
 *  IMPACT_UP (radians), standing back as far as it takes to have them no
 *  more than IMPACT_ABOVE over the middle of the frame - under the HUD's
 *  bars, crown and soles in the frame (the field widens for the rest, see
 *  IMPACT_FILL): at the top of the arc 4.5 m off instead of 3.4. And the
 *  shot's hold runs from the moment the victim is back on the floor, for
 *  IMPACT_DOWN, so its last frames are the victim down, not in the air -
 *  never waiting more than IMPACT_AIR past the carry for that. */
const IMPACT_TOP=2.8,IMPACT_UP=.21,IMPACT_ABOVE=.22,IMPACT_DOWN=.45,IMPACT_AIR=1.6;
/** A summon: a vertical capsule whose axis runs from y0 to y1 at (x, z),
 *  `radius` round. It is the caster's own - he stands inside it or holds it
 *  up - so it never hides him: only the victim is looked for past it. */
type Summon={x:number;z:number;y0:number;y1:number;radius:number};
const summon=():Summon=>({x:0,z:0,y0:0,y1:0,radius:0});

/** How big a body is against a normal one, the way FollowCamera sizes its
 *  rig for it: Kurobi is the 8 m rig's fox, the two Guardian the 7.5 m rig's.
 *  (Round 4b: Gummy's SUNRISE is his own size; Full Swell was a large form.) */
export function bodyBulk(state:{fighter:FighterId;awakened?:boolean}){
  if(state.fighter==='hawser')return state.awakened?3.4/1.7:1;
  if(!state.awakened)return 1;
  return state.fighter==='konta'?8/4.5:state.fighter==='shiden'||state.fighter==='shirokane'?7.5/4.5:1;
}
/** How big a body is as drawn: its own size, or - while its own model is
 *  hidden behind a form it shows outside the awakening (Gummy's GRAND TIDE
 *  is thrown as SUNRISE) - the form's, as though awakened. (Framed at its own
 *  size, Full Swell's arm once filled the whole release shot.) */
export function drawnBulk(body:{state:{fighter:FighterId;awakened?:boolean;alive?:boolean};model?:{visible:boolean}}){
  const s=body.state;
  if(!s.awakened&&body.model&&!body.model.visible&&s.alive!==false)return bodyBulk({fighter:s.fighter,awakened:true});
  return bodyBulk(s);
}
const reach2=(s:number,ax:number,ay:number,az:number,dx:number,dy:number,dz:number,x:number,z:number,y0:number,y1:number)=>{
  const px=ax+dx*s-x,pz=az+dz*s-z,py=ay+dy*s,above=py<y0?y0-py:py>y1?py-y1:0;
  return px*px+pz*pz+above*above;
};
/** The least distance between the segment a->b and the vertical segment at
 *  (x, z) from height y0 to y1: how far a sight line passes from a body's
 *  axis. The squared distance is convex along a->b, so a ternary search finds
 *  its minimum. */
export function sightClearance(a:THREE.Vector3,b:THREE.Vector3,x:number,z:number,y0:number,y1:number,enough=Infinity){
  const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z;
  // Seen from above, the line cannot come nearer than its closest approach
  // on the floor plan; far enough off there, that is the answer.
  const flat=dx*dx+dz*dz,s=flat>1e-12?THREE.MathUtils.clamp(((x-a.x)*dx+(z-a.z)*dz)/flat,0,1):0;
  const across=Math.hypot(a.x+dx*s-x,a.z+dz*s-z);
  if(across>=enough)return across;
  let lo=0,hi=1;
  for(let i=0;i<34;i++){
    const m1=lo+(hi-lo)/3,m2=hi-(hi-lo)/3;
    if(reach2(m1,a.x,a.y,a.z,dx,dy,dz,x,z,y0,y1)<reach2(m2,a.x,a.y,a.z,dx,dy,dz,x,z,y0,y1))hi=m2;else lo=m1;
  }
  return Math.sqrt(reach2((lo+hi)/2,a.x,a.y,a.z,dx,dy,dz,x,z,y0,y1));
}

/** Short authored shots overlaid on the gameplay rig (Settings.cinematics).
 *
 *  FollowCamera composes the gameplay shot and takes `movementYaw` from it
 *  first; the director only ever moves the picture, so the keys keep the
 *  gameplay heading throughout a shot. A shot is blended in polar terms round
 *  its subject - azimuth, ground distance, height - rather than by lerping
 *  world positions, which cuts the chord through the fighter on every swing
 *  from behind to the front. A shot that starts over another one inherits
 *  where the lens actually was and sheds the difference (`carry`), so shots
 *  never cut into each other. Every shot ends early when the player is hit,
 *  turns the view, or the reason for it goes away. No shot films from inside
 *  a fighter, and the hero shot is only taken from where the caster can be
 *  seen (see `crowd`). */
export class CameraDirector {
  /** Settings.cinematics, written by FollowCamera every frame. */
  enabled=false;
  ceded=false;
  /** The camera is in the Close style (FollowCamera writes it every frame): an awakening that starts while it is is
   *  filmed as its close-up (closeStyle.ts CLOSE_SHOT) instead, and keeps that shot to its end whatever the
   *  style does meanwhile. */
  closeStyle=false;
  private closeUp=false;
  /** The local player's id, from `handle`. */
  localId='';
  /** Every fighter, written once by main.ts: the bodies the hero shot needs a
   *  clear sight line past and the lens is kept out of. Without it the shots
   *  are placed as though the arena were empty. */
  crowd?:ReadonlyMap<string,Fighter>;
  kind:ShotKind='none';
  /** How much of the presented frame is the shot's, 0..1. */
  weight=0;
  /** Which of the ultimate's shots is on screen (see HERO_HOLD): 'close',
   *  the swing to the release ('swing'), 'release'; otherwise the kind.
   *  Read-only, for the evidence captures and the tests. */
  get phase():string{
    if(this.kind!=='ultimate')return this.kind;
    return this.t<this.aEnd?'close':this.toB<0||this.t<this.aEnd+this.toB?'swing':this.tour?'field':'release';
  }
  /** The point the shot is about, for the scenery cutaway. */
  readonly pivot=new THREE.Vector3();
  /** Who the shot on screen is about - the caster and the victim of an
   *  ultimate, everybody a time stop caught, the victim of an impact or a KO,
   *  the winner - for the occlusion fade, which never thins them out. Filled
   *  in place; unused slots are undefined. */
  get focus():readonly (Fighter|undefined)[]{
    this.focusList.fill(undefined);this.focusCount=0;
    if(this.kind==='none'||this.weight<=0)return this.focusList;
    this.putFocus(this.subject);
    if(this.kind==='ultimate'){this.putFocus(this.releaseVictim);this.putFocus(this.opponent);if(this.tour)this.crowd?.forEach(this.focusField);}
    else if(this.kind==='impact'||this.kind==='ko'||this.kind==='opener'){this.putFocus(this.caster);this.putFocus(this.opponent);}
    return this.focusList;
  }
  /** Round 3c: the victim a shot on screen is about besides the caster - the
   *  release's, the impact's, the one a time stop caught first - for the
   *  occlusion fade (see OcclusionFader.shotVictim); undefined through the
   *  close-up, which is the caster's. */
  get shotVictim():Fighter|undefined{
    if(this.weight<=0)return undefined;
    if(this.kind==='impact')return this.subject;
    if(this.kind==='ultimate'&&this.t>=this.aEnd)return this.releaseVictim?.state.alive?this.releaseVictim:undefined;
    return undefined;
  }
  /** Round 3c: whether the caster as drawn - a cape, a coat - stands on the
   *  lens's sight line to shotVictim this frame (see CASTER_HIDES), for the
   *  occlusion fade: the caster's joints alone put a cape flung out beside
   *  them outside their box, and the fade never opened for it. */
  victimBehindCaster=false;
  private hiddenHold=0;
  private focusCount=0;
  private putFocus(body?:Fighter){if(body&&this.focusCount<this.focusList.length&&!this.focusList.includes(body))this.focusList[this.focusCount++]=body;}
  private focusField=(body:Fighter)=>{if(this.inField(body))this.putFocus(body);};
  private focusList:(Fighter|undefined)[]=[undefined,undefined,undefined,undefined,undefined,undefined];
  /** The local player, as the last shot saw them. */
  private caster?:Fighter;
  private t=0;
  private length=0;
  private leaving=-1;
  private leaveFrom=0;
  private leaveOver=.3;
  private subject?:Fighter;
  private side=1;
  /** The victory orbit's turn off its usual angle, away from a wall (see VICTORY_TURNS). */
  private victoryTurn=0;
  private startAz=0;
  private startR=0;
  private startY=0;
  private opening=false;
  private pull=0;
  private firm=1;
  private carried=CARRY;
  /** How long the difference is shed over: CARRY, or the impact shot's own
   *  travel-timed carry from the release shot. */
  private carryOver=CARRY;
  private impactCarry=CARRY;
  private introLeft=-1;
  private introSweep=0;
  private victim?:Fighter;
  private lastEvent=0;
  private lastAction='';
  private lastKey=NaN;
  private sinceReset=0;
  private bridge=false;
  private carryAz=0;
  private carryR=0;
  private carryY=0;
  private carryFov=0;
  private carryLook=new THREE.Vector3();
  private shownEye=new THREE.Vector3();
  private shownLook=new THREE.Vector3();
  private shownFov=50;
  private eye=new THREE.Vector3();
  private look=new THREE.Vector3();
  private fov=50;
  private scratch=new THREE.Vector3();
  private left=new THREE.Vector3();
  private right=new THREE.Vector3();
  private facing=0;
  private ray=new THREE.Raycaster();
  private hits:THREE.Intersection[]=[];
  /** The hero shot as chosen (`hero`): which of HERO_FRAMINGS, whether it is
   *  framing an overhead charge, the move's release, how far into the cast it
   *  began, and how long its lens has been blocked. */
  private framing=0;
  private overhead=false;
  private release=0;
  private castAge=0;
  private blocked=0;
  private charge=new THREE.Vector3();
  private fitR=0;
  private fitPitch=0;
  private fitFov=CHARGE_FOV;
  /** This frame's scenery, for the charge framing's room. */
  private walls:readonly THREE.Object3D[]=[];
  /** The hero shot's bearing round the caster and how fast it is turning
   *  (see TURN_STEP). */
  private heroAz=0;
  private heroTurn=0;
  /** The hero shot's swing in, its whip back (before `fit`), the share of
   *  both a short shot keeps, and how long a hand-back cut short takes (see
   *  LENS_SPEED and SWING). */
  private into=HERO_IN;
  private out=HERO_OUT;
  private fit=1;
  private handBack=INTERRUPT;
  /** The length the close shot's push-in is laid over: the planned one,
   *  whatever the swings later add. */
  private planned=HERO_MAX;
  /** The three-shot ultimate (see HERO_HOLD): when the close-up ends, how
   *  long the swing to the release shot takes (negative until it starts),
   *  how long the release shot may hold with no impact, when the finishing
   *  contact is due and how far the technique flies to it; the victim, and
   *  the release shot's bearing round the caster with its turn. The close-up
   *  as posed, while the swing blends it away. */
  private aEnd=0;
  private toB=-1;
  private bUntil=0;
  private finish=0;
  private flight=0;
  private releaseVictim?:Fighter;
  private releaseAz=0;
  private releaseTurn=0;
  private heroEye=new THREE.Vector3();
  private heroLook=new THREE.Vector3();
  private heroFov=HERO_FOV;
  private point=new THREE.Vector3();
  private aspect=16/9;
  private fitSide=0;private fitYaw=0;private fitCount=0;private fitFrom=0;private fitTo=0;
  private fitEl=new Float64Array(8);private fitTop=new Float64Array(8);private fitBottom=new Float64Array(8);private fitSoft=new Uint8Array(8);
  /** The impact shot: its victim once the hit is in, its bearing round them,
   *  and how long it takes to come in when nothing was on screen. */
  private impactVictim?:Fighter;
  /** The time-stop sequence (see FIELD_R): whether this ultimate is one, when
   *  its clock stops (cast seconds) and where, the field's eased centre and
   *  spread, the bearing the lens stands on, and how many the stop holds. */
  private tour=false;
  private stopAt=0;
  private stopRadius=0;
  private tourOrigin=new THREE.Vector3();
  private tourAnchored=false;
  private fieldCentre=new THREE.Vector3();
  private fieldUser=new THREE.Vector3();
  private fieldPlaced=false;
  private fieldAz=0;
  private fieldCount=0;
  private fieldSpread=0;
  private impactAz=0;
  private impactIn=0;
  private impactLead=0;
  private opponent?:Fighter;
  /** Scratch for the crowd walks, which run as a bound callback so a frame's
   *  walk allocates nothing. */
  private sightFrom=new THREE.Vector3();
  private sightTo=new THREE.Vector3();
  private sightSubject?:Fighter;
  private sightAhead=0;
  private sightBlocked=false;
  private pushed=new THREE.Vector3();
  private nearFrom=new THREE.Vector3();
  private nearSkip?:Fighter;
  private nearHit=false;
  private lineX=0;
  private lineZ=0;
  private lineR=0;
  private lineReach=0;
  private lineVictim?:Fighter;
  /** The impact shot's turn away from the walls (see IMPACT_AHEAD), how far
   *  the drawn body is from the root the pivot is taken from, eased, and the
   *  field the whole body needs this frame. */
  private impactTurn=0;
  private impactGoal=0;
  private drawnOffset=new THREE.Vector3();
  private drawnPoint=new THREE.Vector3();
  private ahead=new THREE.Vector3();
  private impactFit=IMPACT_FOV;
  private victoryFit=VICTORY_FOV;
  /** Round 3b: this frame's summons (see GUARDIAN_BACK) and how many; the
   *  bodies the crowd test leaves out and its scratch (see CROWD_MOST); the
   *  release shot's chosen side and turn, kept while they still work (see
   *  RELEASE_SEARCH); and everybody a time stop caught, framed through the
   *  resume however far it throws them. */
  private summons:Summon[]=[summon(),summon(),summon(),summon()];
  private summonCount=0;private summoner?:Fighter;
  private crowdA?:Fighter;private crowdB?:Fighter;private crowdWorst=0;
  private viewEye=new THREE.Vector3();private viewForward=new THREE.Vector3();private viewRight=new THREE.Vector3();private viewUp=new THREE.Vector3();
  private crowdTanV=1;private crowdTanH=1;
  private releaseGoalTurn=NaN;private releaseGoalSide=1;private releaseGoalReach=0;private probeReach=0;private releaseSearched=-Infinity;
  private caught:Fighter[]=[];private caughtCount=0;
  private probeEye=new THREE.Vector3();private probeLook=new THREE.Vector3();
  /** Round 3c: the caster as drawn (see CASTER_POINTS) - world positions,
   *  how many, when and of whom they were taken - and the lens's push out of
   *  them, eased, with the push it is making for. */
  private drawn=new Float32Array(CASTER_POINTS*3);private drawnCount=0;private drawnClock=-Infinity;private drawnOf?:Fighter;
  private drawnTotal=0;private drawnStride=1;private drawnSeen=0;
  private clothPush=new THREE.Vector3();private clothGoal=new THREE.Vector3();private clothProbe=new THREE.Vector3();
  /** Round 3c: the floor the impact's victim left, and when they were down. */
  private impactFloor=0;private impactDownAt=-1;
  /** Round 3e: the awakening's swing to a clear bearing (radians), and
   *  whether it began behind a wall and leaves the wall to the stage fade
   *  (see AWAKEN_STEP). */
  private awakenSwing=0;private awakenFree=false;
  // Nearby opponents include tall bodies and wide coats which the generic
  // gameplay capsule deliberately does not describe. Sample their shown skin
  // once when choosing this short shot; never raycast every triangle per frame.
  private awakenBlockers=Array.from({length:16},()=>new THREE.Box3());
  private awakenBlockerCount=0;
  private awakenProbe=new THREE.Vector3();
  private awakenHit=new THREE.Vector3();
  /** Round 3f (CAM5): the awakening framed on the head (see AWAKEN_AT): the
   *  entry the shot is of, how long the presented state has not shown it, the
   *  beat's own clock; the head as followed and its velocity, where the drawn
   *  silhouette tops out, the form's head bone while one stands in; the size
   *  the lens stands back by; the head's place on the screen this frame and
   *  the carry of it from a shot this one started over. */
  private awakenKey=NaN;private awakenAway=0;private awakenClock=0;
  private awakenHead=new THREE.Vector3();private awakenPoint=new THREE.Vector3();private awakenCrown=new THREE.Vector3();private awakenBody=new THREE.Vector3();
  private awakenOwn=new THREE.Vector3();private awakenOwnFollow=new THREE.Vector3();private awakenOwnV=new THREE.Vector3();
  private awakenFormAt=new THREE.Vector3();private awakenFormFollow=new THREE.Vector3();private awakenFormV=new THREE.Vector3();private awakenFormSeen=false;
  private awakenBone?:THREE.Object3D;private awakenBoneOf?:THREE.Object3D;
  private awakenSize=1;private awakenIn=AWAKEN_IN;private awakenWide=0;private awakenForm=0;private awakenExcess=0;private awakenExcessGoal=0;
  private awakenCarryX=0;private awakenCarryY=0;private awakenBridge=false;
  private screen={x:0,y:0};
  /** Read-only, for the evidence captures and the tests: where the awakening
   *  puts the head on the screen this frame, the head it follows, the beat's
   *  clock, how far it has gone over to a form, the size it stands back by and
   *  how far the lens is widened. */
  readonly awakenFrame={x:0,y:0,head:new THREE.Vector3(),clock:0,form:0,size:1,widen:0};

  /** Round 4 (CAMERA): when each fighter last hit the local player (on this
   *  director's clock), for the dynamic camera's threat weights, read with
   *  `hitAgo`; whom the local player last hit, and when; and the gameplay
   *  shots the local player's own blows ask for (CameraBrain PLAY_*), which
   *  FollowCamera's play layer drains every frame in dynamic mode. */
  private hitBy=new Map<string,number>();private hitOn=new Map<string,number>();
  private historyPruneAt=0;
  get historyEntries(){return this.hitBy.size+this.hitOn.size;}
  readonly cues:{kind:PlayKind;ender:boolean}[]=[{kind:'launch',ender:false},{kind:'launch',ender:false},{kind:'launch',ender:false},{kind:'launch',ender:false}];
  cueCount=0;
  /** Seconds since `id` last hit the local player; Infinity if it never has. */
  hitAgo(id:string){const at=this.hitBy.get(id);return at===undefined?Infinity:this.sinceReset-at;}
  /** Round 4b (TARGETING): the local player's string as it lands - blows on
   *  anybody, each within STRING_GAP of the last: how many have landed (0 once
   *  the gap has passed) and the seconds since the last. (It was read for the
   *  dynamic camera's dolly in on a string, which launch night took out - see
   *  CameraBrain; kept as a read for the evidence captures.) */
  private strungCount=0;private strungAt=-Infinity;
  strung(){return this.sinceReset-this.strungAt<STRING_GAP?this.strungCount:0;}
  strungAgo(){return this.sinceReset-this.strungAt;}
  private cue(kind:PlayKind,ender:boolean){if(this.cueCount<this.cues.length){const c=this.cues[this.cueCount++];c.kind=kind;c.ender=ender;}}
  reset(){this.historyPruneAt=0;this.hitBy.clear();this.hitOn.clear();this.strungCount=0;this.strungAt=-Infinity;this.cueCount=0;this.kind='none';this.weight=0;this.leaving=-1;this.pull=0;this.carried=this.carryOver=CARRY;this.subject=undefined;this.victim=undefined;this.impactVictim=undefined;this.releaseVictim=undefined;this.opponent=undefined;this.introLeft=-1;this.lastEvent=0;this.lastAction='';this.lastKey=NaN;this.sinceReset=0;this.bridge=false;this.carryAz=this.carryR=this.carryY=this.carryFov=0;this.carryLook.set(0,0,0);this.blocked=0;this.drawnCount=0;this.drawnOf=undefined;this.drawnClock=-Infinity;this.clothPush.set(0,0,0);}
  /** The match countdown: `seconds` until it starts. Zero ends it. */
  intro(seconds:number){
    if(!(seconds>0)){this.introLeft=-1;if(this.kind==='intro')this.cancel(INTRO_ABORT);return;}
    // A countdown that moves while its sweep is already on screen keeps the
    // sweep it has; one that has not reached its sweep yet takes the new time.
    if(this.kind==='intro')return;
    this.introLeft=seconds;this.introSweep=Math.min(seconds,INTRO_SWEEP);
  }
  /** The match is over: orbit `winner` for `seconds`. Zero ends it. */
  victory(winner:Fighter,seconds:number){
    if(!(seconds>0)){if(this.kind==='victory')this.cancel(.6);return;}
    this.start('victory',winner,seconds);
  }
  /** Authoritative events: the local player's KO starts the push toward the
   *  victim; the local player being hit ends whatever is on screen. */
  handle(events:readonly CombatEvent[],localId:string,lookup:(id:string)=>Fighter|undefined){
    this.localId=localId;
    for(const event of events){
      if(event.id<=this.lastEvent)continue;
      this.lastEvent=event.id;
      // Round 4: who hit the local player, cinematics or not (see `hitAgo`).
      if(event.kind==='hit'&&localId&&event.targetId===localId&&event.actorId)this.hitBy.set(event.actorId,this.sinceReset);
      // Round 4b: the local player's string, cinematics or not (see `strung`).
      if(event.kind==='hit'&&localId&&event.actorId===localId&&event.targetId&&event.targetId!==localId){this.strungCount=this.sinceReset-this.strungAt<STRING_GAP?this.strungCount+1:1;this.strungAt=this.sinceReset;}
      if(!this.enabled||!localId)continue;
      // Round 4: the gameplay shots the local player's own blows ask for - a
      // true launch's lift, a knockdown's punch-in, the punch-in of a splat
      // against a wall the player sent them into - and whether the blow ended
      // its string (an ender, a heavy or special, a rush's finisher), which is
      // all the play layer allows mid-string (CameraBrain ShotGate).
      if(event.kind==='hit'&&event.actorId===localId&&event.targetId&&event.targetId!==localId){
        this.hitOn.set(event.targetId,this.sinceReset);
        const ender=!!event.branch||event.slot==='heavy'||event.slot==='special'||(event.slot==='light'&&(event.chain??0)>=RUSH_STAGES-1);
        // A knockdown throw reads `reaction: 'launched'` (it leaves the floor)
        // with `outcome: 'knockdown'`, so the outcome is asked first.
        if(event.reaction==='knockdown'||event.outcome==='knockdown')this.cue('knockdown',ender);
        else if(event.reaction==='launched'&&(event.outcome===undefined||event.outcome==='launch'))this.cue('launch',ender);
      }
      if(event.kind==='wall-splat'&&event.actorId!==localId){const at=this.hitOn.get(event.actorId);if(at!==undefined&&this.sinceReset-at<1.5)this.cue('splat',true);}
      if(event.kind==='eliminated'&&event.actorId===localId&&event.targetId&&event.targetId!==localId)this.victim=lookup(event.targetId);
      if(event.kind==='hit'&&event.targetId===localId&&this.kind!=='none'&&this.kind!=='victory')this.cancel(INTERRUPT);
      // The local player's ultimate landing its finishing contact.
      if(event.kind==='hit'&&event.slot==='ultimate'&&event.actorId===localId&&event.targetId&&event.targetId!==localId){
        const caster=lookup(localId),move=moveFor(event.fighter??caster?.state.fighter??'taisei','ultimate',!!caster?.state.awakened);
        if(event.contactIndex===undefined||event.contactIndex>=move.contacts.length-1)this.impactVictim=lookup(event.targetId);
      }
    }
  }
  /** End the current shot, blending back to the gameplay shot over `over` s. */
  cancel(over=.3){
    if(this.kind==='none'||this.leaving>=0)return;
    // Round 4: a countdown sweep ended early - the player turning, a hit - is
    // over for this countdown. It used to start again the frame after it had
    // handed back, at full weight mid-sweep: a cut back into it.
    if(this.kind==='intro')this.introLeft=-1;
    // A hero shot standing wide hands back at the pace of its own swings.
    if(this.kind==='ultimate'||this.kind==='impact')over=Math.max(over,this.handBack);
    // Round 3d (ULTS): the opener's push-in is a small move, and a whiff's
    // return is quick.
    if(this.kind==='opener')over=Math.min(over,OPENER_OUT);
    this.leaving=this.t;this.leaveFrom=this.weight;this.leaveOver=over;
  }

  /** Overlay the current shot on the gameplay shot FollowCamera has just
   *  placed (`eye`, `look`, `fov`). Returns the weight presented. `bulk` is the
   *  subject's size relative to a normal body; `turned` is the player moving
   *  the view this frame. */
  apply(dt:number,camera:THREE.PerspectiveCamera,self:Fighter,eye:THREE.Vector3,look:THREE.Vector3,fov:number,occluders:readonly THREE.Object3D[],bulk:number,turned:boolean,opponent?:Fighter){
    // Enemy IDs churn forever in Last Stand. Retain only the event windows
    // used by group framing and wall-splat shots, without a per-frame scan.
    if(this.sinceReset>=this.historyPruneAt){
      this.historyPruneAt=this.sinceReset+1;
      for(const [id,at] of this.hitBy)if(this.sinceReset-at>HIT_FOR)this.hitBy.delete(id);
      for(const [id,at] of this.hitOn)if(this.sinceReset-at>1.5)this.hitOn.delete(id);
    }
    this.sinceReset+=dt;this.walls=occluders;this.aspect=camera.aspect;this.opponent=opponent;this.caster=self;if(this.kind==='none'){this.victimBehindCaster=false;this.hiddenHold=0;}
    // Round 3f (CAM5): the gameplay shot as it stands, for the awakening's
    // start (see AWAKEN_HEAD_SPEED), and this frame's own length.
    this.gameLook.copy(look);this.gameLens=fov;this.frameDt=dt;
    // The summons are the ultimate's and the impact's own, found afresh each frame.
    this.summonCount=0;
    const local=!!this.localId&&self.state.id===this.localId;
    if(local){
      // Read off the presented (predicted) state, so the shot starts on the
      // frame the cast is drawn rather than a round trip later.
      const action=self.state.action,key=self.state.actionSeq??self.state.actionStarted;
      const fresh=(action!==this.lastAction||key!==this.lastKey)&&self.state.actionTime*self.state.actionDuration<.35;
      // Round 3d (ULTS): a hit-confirm ultimate opens on the push-in; its
      // cinematic waits for the confirm, and a whiff lets the push-in go.
      // (An awakened form keeps its base move's confirm; MOVES is read rather
      // than moveFor, which builds an awakened move afresh every call.)
      const confirms=action==='ultimate'&&!!MOVES[self.state.fighter].ultimate.confirm;
      // Round 3f (CAM5): the same entry back after the presented state dropped
      // it for a few frames carries on its own shot (see AWAKEN_GRACE).
      const resumed=action==='awaken'&&this.kind==='awaken'&&this.leaving<0&&key===this.awakenKey;
      if(this.enabled&&fresh&&!resumed&&(action==='ultimate'||action==='awaken')&&self.state.alive)this.start(confirms?'opener':action,self,confirms?OPENER_MOST:0,eye,bulk,occluders);
      if(this.enabled&&confirms&&self.state.confirmedAt!==undefined&&this.cineKey!==key&&self.state.alive){this.cineKey=key;if(!this.ceded)this.start('ultimate',self,0,eye,bulk,occluders,undefined,true);}
      if(this.kind==='opener'&&(self.state.whiffedAt!==undefined||action!=='ultimate'))this.cancel(OPENER_OUT);
      this.lastAction=action;this.lastKey=key;
    }
    if(this.introLeft>0){
      this.introLeft-=dt;
      if(this.enabled&&this.introLeft<=this.introSweep&&this.introLeft>0&&this.kind==='none'){
        this.start('intro',self,this.introSweep,eye);this.t=this.introSweep-this.introLeft;
      }
      if(this.introLeft<=0)this.introLeft=-1;
    }
    if(this.impactVictim){
      // The ultimate's finishing contact: carried onto the victim, from the
      // release shot or from nothing (a caster with no clear hero shot).
      const victim=this.impactVictim;this.impactVictim=undefined;
      // A stop that caught several holds its field through the resume: all
      // of them blasted at once is the shot (see FIELD_R).
      const crowd=this.kind==='ultimate'&&this.tour&&this.fieldCount>1;
      if(this.enabled&&local&&!crowd&&!this.ceded&&(this.kind==='none'||this.kind==='ultimate')&&victim.group.position.distanceTo(self.group.position)<IMPACT_RANGE)this.start('impact',victim,0,eye,bodyBulk(victim.state),occluders,self);
    }
    if(this.victim){
      const victim=this.victim;this.victim=undefined;
      if(this.enabled&&!this.ceded&&(this.kind==='none'||this.kind==='intro'||this.kind==='ko')&&victim.group.position.distanceTo(self.group.position)<KO_RANGE)this.start('ko',victim,KO_IN+KO_HOLD+KO_OUT);
    }
    // The finisher's own shot has the view (see `ceded`): whatever of the ultimate's the director has on is let go.
    if(this.ceded&&(this.kind==='opener'||this.kind==='ultimate'||this.kind==='impact'||this.kind==='ko'))this.cancel(INTERRUPT);
    if(this.kind==='none'){this.weight=0;return 0;}
    if(this.kind==='victory'&&this.t===0){
      // Decided against the shot it is leaving: the orbit goes round on the
      // lens's own side, and a winner across the arena is a cut, since a
      // sweep that far flies through whatever stands between. A body standing
      // in the orbit's path on that side sends it round the other, if that
      // one is clear.
      const facing=this.facing,from=Math.atan2(eye.x-this.pivot.x,eye.z-this.pivot.z);
      this.side=wrapped(from-facing)>=0?1:-1;
      this.opening=eye.distanceTo(this.pivot)>VICTORY_CUT;this.victoryTurn=0;
      if(this.subject&&!this.orbitClear(this.subject,this.side,eye)&&this.orbitClear(this.subject,-this.side,eye))this.side=-this.side;
      // Both sides against a wall: round the winner to the first orbit with the room for it (VICTORY_TURNS).
      const winner=this.subject;
      if(winner&&this.walls.length&&this.orbitRoom(winner,this.side,0)<VICTORY_ROOM&&this.orbitRoom(winner,-this.side,0)<VICTORY_ROOM){
        let side=this.side,turn=0,most=-1;
        search:for(const t of VICTORY_TURNS)for(const s of [this.side,-this.side]){
          const room=this.orbitRoom(winner,s,t);
          if(room>=VICTORY_ROOM&&this.orbitClear(winner,s,eye,t)){side=s;turn=t;break search;}
          if(room>most){most=room;side=s;turn=t;}
        }
        this.side=side;this.victoryTurn=turn;
      }
    }
    if(!this.enabled||turned)this.cancel(INTERRUPT);
    const step=this.kind==='intro'?dt:Math.min(dt,SHOT_STEP);
    const subject=this.subject;
    // The impact follows its victim down as well: a finisher that KOs is the
    // shot's whole point.
    // Round 3f (CAM5): an entry is only let go once the presented state has
    // not shown it for AWAKEN_GRACE.
    if(this.kind==='awaken')this.awakenAway=self.state.action==='awaken'?0:this.awakenAway+dt;
    if(!subject||(this.kind!=='ko'&&this.kind!=='impact'&&!subject.state.alive)||(this.kind==='ultimate'&&self.state.action!=='ultimate')||(this.kind==='awaken'&&this.awakenAway>AWAKEN_GRACE&&this.t<AWAKENING_ENTRY-.1))this.cancel(INTERRUPT);
    this.t+=step;
    // Round 3c: the caster as drawn, for the lens to keep off (see CASTER_POINTS);
    // round 3f, the transforming fighter's too - a form reaches past a body's
    // capsule (Kurobi's back, Full Swell's arms).
    if((this.kind==='ultimate'||this.kind==='impact'||this.kind==='awaken')&&this.caster?.state.alive)this.sampleCaster(this.caster);else this.drawnCount=0;
    this.gameLook.copy(look);
    let w=this.script(subject??self,eye,fov,bulk,step);
    if(this.leaving>=0)w=Math.min(w,this.leaveFrom*(1-ease((this.t-this.leaving)/this.leaveOver)));
    // Over once nothing of it is left on screen - including a wall pull-in
    // still relaxing, or its end would be a jump.
    const spent=this.t>=this.length||(this.leaving>=0&&(this.t-this.leaving>=this.leaveOver||w<=1e-6))||(w<=1e-6&&this.t>.05);
    const settled=this.pull<1e-3&&this.carried>=this.carryOver;
    if(spent&&settled){this.kind='none';this.weight=0;this.leaving=-1;return 0;}
    if(spent)w=0;
    // Nothing of the shot on screen yet: the gameplay shot stands untouched,
    // not re-derived through the polar blend.
    if(w<=1e-6&&settled){this.weight=0;return 0;}
    this.weight=w;
    this.present(step,camera,subject??self,eye,look,fov,occluders,w);
    return w;
  }

  private start(kind:ShotKind,subject:Fighter,length:number,eye?:THREE.Vector3,bulk=1,occluders:readonly THREE.Object3D[]=[],caster?:Fighter,cine=false){
    // The hero shot is chosen before anything is committed: with nowhere to
    // take it from, whatever is on screen carries on untouched. A hit-confirm
    // ultimate's cinematic has no close-up (round 3d, see `cinematic`).
    if(kind==='ultimate'&&!(cine?this.cinematic(subject,eye,bulk,occluders):this.hero(subject,eye,bulk,occluders)))return;
    // Round 3d (ULTS): the opener's push-in is the gameplay shot's own line
    // pushed in; from a gameplay lens standing behind scenery (the cutaway
    // shows the room through it) that line goes through the wall, and the
    // lens would be pulled in front of it a metre off the caster - so there
    // is no push-in, and the gameplay shot watches the opener.
    if(kind==='opener'&&eye&&occluders.length){
      this.setPivot(subject,bulk);
      const gx=eye.x-this.pivot.x,gz=eye.z-this.pivot.z,r=Math.hypot(gx,gz);
      if(r>1e-3&&this.clear(Math.atan2(gx,gz),r,occluders)<r-1e-3)return;
    }
    if(kind==='ultimate')this.cine=cine;
    if(kind==='impact'){this.impact(subject,caster,eye,bulk);}
    // Over a shot already on screen, the new one starts from where the lens
    // actually is (see `carry`).
    this.bridge=this.kind!=='none'&&this.weight>1e-3;
    this.kind=kind;this.subject=subject;this.t=0;this.leaving=-1;this.pull=0;this.firm=-1;this.blocked=0;
    this.opening=kind==='intro'&&this.sinceReset<.2;
    if(kind==='ultimate'||kind==='impact')return;
    this.length=length;
    this.setPivot(subject,kind==='victory'?bodyBulk(subject.state):bulk);
    const facing=this.facing=this.bodyFacing(subject);
    if(kind==='awaken'){
      this.closeUp=this.closeStyle;
      this.length=AWAKENING_ENTRY+(this.closeUp?CLOSE_SHOT.out:AWAKEN_OUT);
      const from=eye??this.scratch.set(this.pivot.x,this.pivot.y+1,this.pivot.z-4);
      this.startAz=Math.atan2(from.x-this.pivot.x,from.z-this.pivot.z);this.startR=Math.hypot(from.x-this.pivot.x,from.z-this.pivot.z);this.startY=from.y-this.pivot.y;
      this.side=wrapped(facing-this.startAz)>=0?1:-1;
      if(FRONT_AWAKEN.has(subject.state.fighter)){
        // Stay on the nearest side of the fighter rather than taking the long
        // way around their back. Leave room for both the face and active hand.
        this.startAz=facing-this.side*FRONT_AWAKEN_ANGLE;
      }
      // The Close close-up: a front three-quarter view, from its own reach and low (CLOSE_SHOT), whatever the
      // gameplay lens's - set before the search below, which looks for room for exactly this.
      if(this.closeUp){this.startAz=facing-this.side*CLOSE_SHOT.angle;this.startR=CLOSE_SHOT.reach;this.startY=CLOSE_SHOT.low;}
      // Round 3e (CAM4): from a bearing with room (see AWAKEN_STEP).
      this.awakenSwing=0;this.awakenFree=false;
      this.sampleAwakenBlockers(subject);
      if((occluders.length||this.awakenBlockerCount)&&this.startR>1e-3){
        const want=this.startR*AWAKEN_ROOM,orbit=AWAKEN_ORBIT*AWAKEN_ORBIT_SHARE;
        const wallBlocked=occluders.length>0&&(this.clear(this.startAz,want,occluders)<want-1e-3||this.clear(this.startAz+this.side*orbit,want,occluders)<want-1e-3);
        const roomy=(az:number,side:number)=>{
          for(const u of [0,.5,1]){
            const bearing=az+side*orbit*u;
            if((occluders.length&&this.clear(bearing,want,occluders)<want-1e-3)||!this.awakenBodyClear(bearing,this.startR*1.5))return false;
          }
          return true;
        };
        if(!roomy(this.startAz,this.side)){
          let found=NaN;
          for(let k=1;k*AWAKEN_STEP<=AWAKEN_SEARCH+1e-9&&Number.isNaN(found);k++){
            for(const way of [this.side,-this.side]){
              const az=this.startAz+way*k*AWAKEN_STEP;
              if(roomy(az,wrapped(facing-az)>=0?1:-1)){found=az;break;}
            }
          }
          if(Number.isFinite(found)){this.awakenSwing=Math.abs(wrapped(found-this.startAz));this.startAz=found;this.side=wrapped(facing-found)>=0?1:-1;}
          this.awakenFree=wallBlocked;
        }
      }
      // Round 3f (CAM5): framed on the head (see AWAKEN_AT), from the entry's
      // own clock, and in over long enough for the head's way across the
      // screen from where the gameplay shot has it (AWAKEN_HEAD_SPEED).
      const st=subject.state;
      this.awakenKey=st.actionSeq??st.actionStarted;this.awakenAway=0;this.awakenSize=1;this.awakenBridge=false;this.awakenWide=0;
      this.awakenClock=st.action==='awaken'?st.actionTime*st.actionDuration:0;this.awakenForm=this.formShare(st);
      this.awakenBone=this.awakenBoneOf=undefined;this.drawnCount=0;this.drawnClock=-Infinity;
      this.drawnHeads(subject);this.awakenOwnFollow.copy(this.awakenOwn);this.awakenOwnV.set(0,0,0);this.awakenFormSeen=false;
      this.awakenExcess=this.awakenExcessGoal;this.awakenHead.copy(this.awakenPoint);this.awakenHead.y+=this.awakenExcess*.5;
      this.awakenIn=AWAKEN_BLEND_IN;
      const tan=Math.tan(THREE.MathUtils.degToRad(this.gameLens)/2),s=this.screen;
      const atX=this.closeUp?CLOSE_SHOT.atX:AWAKEN_AT_X,atY=this.closeUp?CLOSE_SHOT.atY:AWAKEN_AT_Y;
      if(eye&&screenOf(this.awakenHead,eye,this.gameLook,tan,tan*this.aspect,s))this.awakenIn=THREE.MathUtils.clamp(1.875*Math.hypot(atX-s.x,atY-AWAKEN_TALL*Math.min(1,this.awakenExcess/AWAKEN_TALL_AT)-s.y)/AWAKEN_HEAD_SPEED,AWAKEN_BLEND_IN,AWAKEN_IN);
      if(FRONT_AWAKEN.has(st.fighter))this.awakenIn=Math.max(this.awakenIn,FRONT_AWAKEN_IN);
      if(this.closeUp)this.awakenIn=Math.max(this.awakenIn,CLOSE_SHOT.in);
    }else if(kind==='opener'){
      // Round 3d (ULTS): on the lens's own line, whatever the gameplay shot
      // does meanwhile (see OPENER_PUSH).
      this.side=1;
    }else if(kind==='intro'){
      // The sweep drifts round the player's right; somebody standing in that
      // arc - the countdown puts the opponent in front - sends it round the left.
      this.side=1;
      if(!this.sweepClear(subject,1,eye)&&this.sweepClear(subject,-1,eye))this.side=-1;
    }
  }
  /** Choose the hero shot for the ultimate `subject` has just started: the
   *  first of HERO_FRAMINGS, on the lens's own side and then the other,
   *  whose lens keeps the caster's chest and head in sight past every other
   *  body - sampled through the shot, bodies moving as they are - for the
   *  whole of it. Failing that, the one that keeps them longest, cut to that
   *  length, if it is still a shot; failing that, no hero shot at all. False,
   *  with nothing changed, when there is none. */
  private hero(subject:Fighter,eye:THREE.Vector3|undefined,bulk:number,occluders:readonly THREE.Object3D[]){
    const state=subject.state,move=moveFor(state.fighter,'ultimate',!!state.awakened),elapsed=state.actionTime*state.actionDuration;
    const kept={length:this.length,planned:this.planned,side:this.side,framing:this.framing,overhead:this.overhead,release:this.release,finish:this.finish,flight:this.flight,castAge:this.castAge,facing:this.facing,releaseVictim:this.releaseVictim};
    this.overhead=move.style==='bomb';this.release=move.contacts[0]??HERO_MAX;this.finish=move.contacts[move.contacts.length-1]??this.release;this.castAge=elapsed;this.walls=occluders;
    this.tour=!!move.timeStop&&!!TIME_STOP_TOURS[state.fighter];this.stopAt=move.timeStop?move.contacts[move.timeStop.contact]:0;this.stopRadius=move.timeStop?.radius??0;
    this.tourAnchored=false;this.fieldPlaced=false;this.fieldCount=0;this.caughtCount=0;
    // The close-up's own length (see HERO_HOLD): what its sight lines are
    // checked over, and what its push-in is laid over.
    this.length=this.planned=THREE.MathUtils.clamp(this.release-elapsed-HERO_OUT,HERO_MIN,HERO_IN+HERO_HOLD);
    // How long the technique flies before it lands, off the victim's distance.
    const victim=this.opponent?.state.alive?this.opponent:undefined,speed=move.speed??0;
    this.flight=victim&&speed>0&&(move.style==='projectile'||move.style==='bomb')?Math.min(3,victim.group.position.distanceTo(subject.group.position)/speed):0;
    this.setPivot(subject,bulk,'ultimate');
    const facing=this.facing=this.bodyFacing(subject);
    // The front three-quarter on the lens's own side, unless a wall is there
    // and the other side is clearer.
    const from=eye?Math.atan2(eye.x-this.pivot.x,eye.z-this.pivot.z):facing+Math.PI;
    let side=Math.abs(wrapped(facing+HERO_ANGLE-from))<=Math.abs(wrapped(facing-HERO_ANGLE-from))?1:-1;
    const want=(this.overhead?CHARGE_ROOM:HERO_FROM)*bulk,near=this.clear(facing+side*HERO_ANGLE,want,occluders),far=this.clear(facing-side*HERO_ANGLE,want,occluders);
    if(near<want*.8&&far>near+.3)side=-side;
    // What the move summons, as it stands through the close-up (see
    // GUARDIAN_BACK): its lens stays out of it and sees the caster past it.
    this.releaseVictim=this.opponent?.state.alive?this.opponent:undefined;
    this.summonsFor(subject,elapsed+this.length*.5);
    // A framing that sees the caster throughout but swings in (and back)
    // across somebody is kept in reserve: a moment's wipe is better than no
    // shot, but a clean swing is better still - and so is one nobody else
    // fills from the foreground (round 3b, see CROWD_MOST): of those, the
    // clean one with the least crowd.
    let best=-1,bestSide=side,bestFor=0,wipe=-1,wipeSide=side,wipeScore=Infinity;
    for(let framing=0;framing<HERO_FRAMINGS.length;framing++)for(let k=0;k<2;k++){
      const s=k?-side:side,seen=this.seenFor(subject,framing,s,bulk);
      if(seen>=this.length){
        const clean=!eye||this.swingClear(subject,framing,s,bulk,eye);
        // A charge shot also wants room to stand back in (see CHARGE_ROOM).
        const room=this.overhead?this.clear(this.facing+s*HERO_FRAMINGS[framing].angle,want,occluders)+(clean?SWING_ROOM:0):clean?1:0;
        const crowded=this.heroCrowd(subject,framing,s,bulk);
        if(clean&&(!this.overhead||room>=want)&&crowded<=CROWD_MOST){this.aim(framing,s,subject,bulk,eye);return true;}
        const score=(clean&&(!this.overhead||room>=want)?0:2)-(this.overhead?Math.min(room,want)/Math.max(want,1e-3):0)+crowded*4;
        if(score<wipeScore){wipeScore=score;wipe=framing;wipeSide=s;}
      }
      if(seen>bestFor){bestFor=seen;best=framing;bestSide=s;}
    }
    if(wipe>=0){this.aim(wipe,wipeSide,subject,bulk,eye);return true;}
    if(best>=0&&bestFor>=HERO_MIN){this.length=this.planned=bestFor;this.aim(best,bestSide,subject,bulk,eye);return true;}
    Object.assign(this,kept);
    return false;
  }
  /** Round 3d (ULTS): set up a hit-confirm ultimate's cinematic, on its
   *  confirm. No close-up: straight into the release shot - caster near, the
   *  victim they hold across the frame - or, for a time stop, its field, from
   *  wherever the lens is (the opener's push-in), in over the swing its
   *  travel needs. It holds through the cinematic's blows; the finisher
   *  carries it onto the victim (the impact shot, from `handle`). Always a
   *  shot: the release shot finds its own clear bearing as it goes. */
  private cinematic(subject:Fighter,eye:THREE.Vector3|undefined,bulk:number,occluders:readonly THREE.Object3D[]){
    const state=subject.state,move=moveFor(state.fighter,'ultimate',!!state.awakened),elapsed=state.actionTime*state.actionDuration;
    this.walls=occluders;this.overhead=false;this.castAge=elapsed;this.release=elapsed;this.flight=0;
    this.finish=move.contacts[move.contacts.length-1]??elapsed;
    this.tour=!!move.timeStop&&!!TIME_STOP_TOURS[state.fighter];this.stopAt=move.timeStop?move.contacts[move.timeStop.contact]:0;this.stopRadius=move.timeStop?.radius??0;
    this.tourAnchored=false;this.fieldPlaced=false;this.fieldCount=0;this.caughtCount=0;
    this.setPivot(subject,bulk,'ultimate');
    const facing=this.facing=this.bodyFacing(subject);
    const from=eye?Math.atan2(eye.x-this.pivot.x,eye.z-this.pivot.z):facing+Math.PI;
    // The victim is whoever the confirm holds - the one the move went to.
    const held=state.target?this.crowd?.get(state.target):undefined;
    this.releaseVictim=held&&held!==subject&&held.state.alive?held:this.opponent?.state.alive?this.opponent:undefined;
    this.side=wrapped(from-facing)>=0?1:-1;this.framing=0;this.heroAz=from;this.heroTurn=0;
    this.releaseGoalTurn=NaN;this.releaseGoalSide=this.side;this.releaseSearched=-Infinity;this.swingLong=false;
    this.summonsFor(subject,elapsed);
    // The swing in is timed by its travel from the lens to where the release
    // shot will stand (a time stop's field climbs out from the caster).
    this.into=HERO_IN;
    if(eye&&!this.tour){this.releaseAz=this.releaseBearing(subject,bulk);this.releaseTurn=0;this.releasePose(subject,bulk);this.into=this.travel(HERO_IN,eye);}
    this.out=HERO_OUT;this.handBack=INTERRUPT;this.fit=1;
    this.aEnd=0;this.toB=this.into;this.planned=0;
    // Through the last blow and the linger after it (a stop's through the
    // resume), and then the impact takes it.
    this.bUntil=Math.max(this.into+RELEASE_HOLD_LEAST,this.finish-elapsed+(this.tour?TOUR_LINGER:RELEASE_LINGER));
    this.length=this.bUntil+this.out;
    return true;
  }
  /** Commit to framing `framing` on side `side`, and time its swings: a
   *  charge shot's on the swing in it will be, from the gameplay lens `eye`
   *  to its pose once it owns the frame (see LENS_SPEED). */
  private aim(framing:number,side:number,subject:Fighter,bulk:number,eye?:THREE.Vector3){
    this.framing=framing;this.side=side;this.heroAz=this.facing+side*HERO_FRAMINGS[framing].angle;this.heroTurn=0;
    this.releaseGoalTurn=NaN;this.releaseGoalSide=side;this.swingLong=false;
    this.into=HERO_IN;this.out=HERO_OUT;this.handBack=INTERRUPT;
    if(this.overhead&&eye){this.heroPose(subject,HERO_IN,framing,this.heroAz,bulk);this.into=this.lensSwing(HERO_IN,eye);}
    // A long way round, the swing in stretches (see SWING) and the close-up
    // runs on by what it added.
    else if(eye)this.into=HERO_IN*this.stretch(eye);
    // The close-up holds HERO_HOLD once in - less when the release is sooner,
    // so the release shot is there for it - and never longer than its sight
    // lines were found clear for.
    const until=this.release-this.castAge;
    this.aEnd=Math.min(this.planned+this.into-HERO_IN,this.into+THREE.MathUtils.clamp(until-this.into-HERO_OUT,HERO_HOLD_LEAST,HERO_HOLD));
    // A time stop's close-up gives way as the clock stops: the tour starts a
    // quarter of a second later, and the field has to be there for it.
    if(this.tour)this.aEnd=Math.max(this.into+TOUR_HOLD_LEAST,Math.min(this.aEnd,until));
    this.planned=this.aEnd;this.fit=1;this.toB=-1;
    // The release shot holds through the finishing contact and the flight to
    // it, then waits RELEASE_LINGER for the impact.
    this.releaseVictim=this.opponent?.state.alive?this.opponent:undefined;
    this.bUntil=Math.max(this.aEnd+HERO_OUT+RELEASE_HOLD_LEAST,this.finish-this.castAge+this.flight+(this.tour?TOUR_LINGER:RELEASE_LINGER));
    this.length=this.bUntil+this.out;
  }
  /** The time stop's field (see FIELD_R) into eye/look/fov: the user and
   *  every opponent inside the stop, from above, on the side the lens
   *  already stands - tracking the user as he crosses it. The crowd walks
   *  run as bound callbacks over scratch fields, so a frame allocates nothing. */
  private fieldPose(caster:Fighter,bulk:number,step:number,gameEye:THREE.Vector3){
    const c=caster.group.position,age=this.castAge+this.t;
    const anchoring=!this.tourAnchored&&age>=this.stopAt;
    if(anchoring){this.tourOrigin.copy(c);this.tourAnchored=true;}
    const origin=this.tourAnchored?this.tourOrigin:this.fieldFrom.copy(c);
    // Round 3b: everybody the stop caught is held by the field until it hands
    // back - through the resume too, however far the blast throws them. The
    // main victim left the frame for 0.8 s of it once the radius let go.
    if(anchoring){this.caughtCount=0;this.gatherFor=caster;this.gatherOrigin=origin;this.crowd?.forEach(this.catchOne);}
    // Who the field holds: the user, and every opponent standing inside the
    // stop (the simulation froze them; on screen they are whoever is there).
    this.gatherFor=caster;this.gatherOrigin=origin;this.gatherX=c.x;this.gatherZ=c.z;this.gatherN=1;this.gatherCount=0;
    this.crowd?.forEach(this.fieldGather);
    const x=this.gatherX/this.gatherN,z=this.gatherZ/this.gatherN;
    this.gatherX=x;this.gatherZ=z;this.gatherSpread=Math.hypot(c.x-x,c.z-z);
    this.crowd?.forEach(this.fieldExtent);
    // Placed on its first frame, from the side the lens stands on; eased
    // after, so the user's moves - a teleport included - carry it smoothly.
    if(!this.fieldPlaced){
      this.fieldCentre.set(x,origin.y,z);this.fieldUser.copy(c);this.fieldSpread=this.gatherSpread;this.fieldPlaced=true;
      // The bearing: from the side the lens is on, turned round as far as it
      // takes for the whole field to fit the narrowest frame - a victim
      // standing between the lens and the rest would otherwise be behind it.
      const from=Math.atan2(gameEye.x-x,gameEye.z-z);let best=Infinity;this.fieldAz=from;
      for(let k=0;k<12;k++){const az=from+Math.ceil(k/2)*(k%2?1:-1)*Math.PI/6,need=Math.max(FIELD_FOV,this.fieldFit(caster,az,this.fieldRadius(bulk,0),bulk))+Math.ceil(k/2)*1.5;if(need<best-1e-6){best=need;this.fieldAz=az;}}
    }
    else{const k=blend(FIELD_EASE,step);this.fieldCentre.x+=(x-this.fieldCentre.x)*k;this.fieldCentre.z+=(z-this.fieldCentre.z)*k;this.fieldCentre.y+=(origin.y-this.fieldCentre.y)*k;this.fieldUser.lerp(c,k);this.fieldSpread+=(this.gatherSpread-this.fieldSpread)*k;this.fieldAz+=FIELD_DRIFT*step*this.side;}
    this.fieldCount=this.gatherCount;
    // Fitted: every body in the field, crown to feet, inside the frame (with
    // a margin for the HUD); past the widest field, the lens stands back.
    let r=this.fieldRadius(bulk,age),fov=FIELD_FOV;
    for(let pass=0;pass<5;pass++){
      fov=Math.max(FIELD_FOV,this.fieldFit(caster,this.fieldAz,r,bulk));
      if(fov<=FIELD_FOV_MOST||r>=FIELD_REACH*bulk)break;
      r=Math.min(FIELD_REACH*bulk,r*Math.max(1.12,fov/FIELD_FOV_MOST));
    }
    this.fov=THREE.MathUtils.clamp(fov,FIELD_FOV,FIELD_FOV_MOST);
  }
  /** How far out the field's lens stands before fitting: the field's spread,
   *  pushed in over the tour. */
  private fieldRadius(bulk:number,age:number){
    const push=1-FIELD_PUSH*THREE.MathUtils.clamp((age-this.stopAt)/Math.max(.1,this.finish-this.stopAt),0,1);
    return Math.max(FIELD_NEAREST,FIELD_R+FIELD_SPREAD*this.fieldSpread)*bulk*push;
  }
  /** Pose the field's lens at bearing `az` and reach `r` into eye/look, and
   *  return the field of view (degrees) holding everybody in it. */
  private fieldFit(caster:Fighter,az:number,r:number,bulk:number){
    const f=this.fieldCentre,u=this.fieldUser;
    // What it looks at: the field's centre, drawn toward the user - where the
    // lens has him, eased like the centre, so a teleport is followed, not cut.
    this.look.set(f.x+(u.x-f.x)*FIELD_TOWARD,f.y+1+(u.y-f.y)*FIELD_TOWARD,f.z+(u.z-f.z)*FIELD_TOWARD);
    this.eye.set(f.x+Math.sin(az)*r,f.y+FIELD_EYE*r,f.z+Math.cos(az)*r);
    // The view's own axes, so every point is measured as the lens will draw it.
    this.holdForward.subVectors(this.look,this.eye).normalize();this.holdRight.crossVectors(this.holdForward,WORLD_UP).normalize();this.holdUp.crossVectors(this.holdRight,this.holdForward);
    this.holdNeed=0;
    this.holdBody(caster.group.position,1.9*bulk);this.crowd?.forEach(this.fieldHold);
    this.holdRoller(caster);
    // The tangent of the half-height that holds them all, with FIELD_MARGIN of it to spare.
    return THREE.MathUtils.radToDeg(2*Math.atan(this.holdNeed/FIELD_MARGIN));
  }
  /** Round 3b: MIDNIGHT's steamroller (signature/Steamroller), held over the
   *  victim for the last second of the stop and crushing them on the
   *  finisher, is framed too - it hung above the top of the field shot until
   *  the slam. Taken in over ROLLER_EASE as it comes into the stop, so the
   *  field opens for it rather than jumping, up to the slam. */
  private holdRoller(caster:Fighter){
    if(caster.state.fighter!=='oro')return;
    const pose=rollerAt(this.castAge+this.t,this.finish);
    if(!pose||pose.since>=0)return;
    const v=this.releaseVictim?.state.alive?this.releaseVictim.group.position:this.fieldCentre;
    const k=THREE.MathUtils.smoothstep(pose.since,-ROLLER_TIMING.drop,-ROLLER_TIMING.drop+ROLLER_EASE);
    const top=1.9+(pose.height+ROLLER_TOP*pose.squash-1.9)*k;
    this.holdBody(v,Math.max(1.9,top));
  }
  /** Scratch for the field's crowd walks (see fieldPose). */
  private fieldFrom=new THREE.Vector3();private gatherFor?:Fighter;private gatherOrigin=this.fieldFrom;
  private gatherX=0;private gatherZ=0;private gatherN=0;private gatherCount=0;private gatherSpread=0;
  private holdNeed=0;private holdForward=new THREE.Vector3();private holdRight=new THREE.Vector3();private holdUp=new THREE.Vector3();private holdPoint=new THREE.Vector3();
  private inField(body:Fighter){
    const caster=this.gatherFor,p=body.group.position,q=body.state;
    if(!caster||body===caster||!q.alive||(caster.state.team!==undefined&&q.team===caster.state.team))return false;
    if(this.tourAnchored&&this.caughtCount)return this.caught.indexOf(body)>=0&&this.caught.indexOf(body)<this.caughtCount;
    return Math.hypot(p.x-this.gatherOrigin.x,p.z-this.gatherOrigin.z)<=this.stopRadius+.5;
  }
  private catchOne=(body:Fighter)=>{
    const caster=this.gatherFor,p=body.group.position,q=body.state;
    if(!caster||body===caster||!q.alive||(caster.state.team!==undefined&&q.team===caster.state.team))return;
    if(Math.hypot(p.x-this.gatherOrigin.x,p.z-this.gatherOrigin.z)>this.stopRadius+.5)return;
    if(this.caughtCount<this.caught.length)this.caught[this.caughtCount]=body;else this.caught.push(body);
    this.caughtCount++;
  };
  private fieldGather=(body:Fighter)=>{if(!this.inField(body))return;this.gatherX+=body.group.position.x;this.gatherZ+=body.group.position.z;this.gatherN++;this.gatherCount++;};
  private fieldExtent=(body:Fighter)=>{if(this.inField(body))this.gatherSpread=Math.max(this.gatherSpread,Math.hypot(body.group.position.x-this.gatherX,body.group.position.z-this.gatherZ));};
  private fieldHold=(body:Fighter)=>{if(this.inField(body))this.holdBody(body.group.position,1.9*bodyBulk(body.state));};
  /** Widen the field's needed half-height (as a tangent, in holdNeed) to hold
   *  `p` from its feet to `top` above them; a point behind the lens cannot be
   *  held at all. */
  private holdBody(p:THREE.Vector3,top:number){
    for(let k=0;k<2;k++){
      const v=this.holdPoint.set(p.x-this.eye.x,p.y+(k?top:0)-this.eye.y,p.z-this.eye.z),depth=v.dot(this.holdForward);
      if(depth<.3){this.holdNeed=Math.max(this.holdNeed,10);continue;}
      this.holdNeed=Math.max(this.holdNeed,Math.abs(v.dot(this.holdUp))/depth,Math.abs(v.dot(this.holdRight))/depth/this.aspect);
    }
  }
  /** The release shot's bearing round the caster (see RELEASE_BEHIND): back
   *  from the victim, over the close-up's shoulder - turned further round
   *  toward the profile, RELEASE_TURN at a time up to RELEASE_WIDEST, where
   *  a wall stands closer behind the caster than the lens would (in a small
   *  hall the swing round met the wall and the pull-in jumped the lens
   *  0.46 m in a frame). */
  private releaseBearing(caster:Fighter,bulk:number){
    const p=caster.group.position,victim=this.releaseVictim?.state.alive?this.releaseVictim:undefined,v=victim?.group.position;
    const bearing=v?Math.atan2(v.x-p.x,v.z-p.z):this.facing,d=v?Math.hypot(v.x-p.x,v.z-p.z):RELEASE_AHEAD;
    const behind=RELEASE_BEHIND+RELEASE_CLOSE*(1-THREE.MathUtils.smoothstep(d,1.5,4));
    const want=RELEASE_R*bulk+CLEARANCE;
    // Round 3b: the victim as well as the caster, past everybody and what the
    // move summons, with nobody filling the frame (see RELEASE_SEARCH). The
    // choice already made stands while it still works, so the lens does not
    // hunt; otherwise over the shoulder first and round toward the front, on
    // this side - and, choosing afresh, on the other - and with nothing that
    // works, the least bad.
    // A search is a few dozen sight lines and a wall probe or two, so a choice
    // that has stopped working is searched again at most every RESEARCH.
    const fresh=!Number.isFinite(this.releaseGoalTurn);
    if(!fresh&&(this.t-this.releaseSearched<RESEARCH||this.releaseMiss(caster,bulk,bearing,this.releaseGoalSide,this.releaseGoalTurn,victim,want)===0)){
      if(this.t-this.releaseSearched>=RESEARCH)this.releaseGoalReach=this.probeReach;
      return bearing+this.releaseGoalSide*(Math.PI-this.releaseGoalTurn);
    }
    this.releaseSearched=this.t;
    let bestTurn=behind,bestSide=this.side,bestMiss=Infinity,bestReach=RELEASE_R*bulk;
    for(let k=0;k<(fresh?2:1);k++){
      const side=k?-this.side:this.side;
      for(let turn=behind;turn<=RELEASE_SEARCH+1e-6;turn+=RELEASE_TURN){
        const miss=this.releaseMiss(caster,bulk,bearing,side,turn,victim,want)+(k?.25:0)+(turn-behind)*.05;
        if(miss<bestMiss){bestMiss=miss;bestTurn=turn;bestSide=side;bestReach=this.probeReach;}
        if(miss<.3)break;
      }
      if(bestMiss<.3)break;
    }
    this.releaseGoalTurn=bestTurn;this.releaseGoalSide=bestSide;this.releaseGoalReach=bestReach;
    return bearing+bestSide*(Math.PI-bestTurn);
  }
  /** Follow the victim round with the release shot's bearing, at the hero
   *  bearing's own limits (see TURN_SPEED). */
  private turnRelease(caster:Fighter,bulk:number,step:number){
    const goal=this.releaseAz+wrapped(this.releaseBearing(caster,bulk)-this.releaseAz),speed=Math.min(TURN_SPEED,TURN_REACH/Math.max(RELEASE_R,1e-3));
    for(let left=step;left>1e-9;left-=1/120){
      const h=Math.min(1/120,left),error=goal-this.releaseAz,size=Math.abs(error);
      const wanted=Math.sign(error)*Math.min(speed,Math.sqrt(1.8*TURN_ACCEL*size),TURN_GAIN*size);
      this.releaseTurn+=THREE.MathUtils.clamp(wanted-this.releaseTurn,-TURN_ACCEL*h,TURN_ACCEL*h);
      this.releaseAz+=this.releaseTurn*h;
    }
  }
  /** The release shot's pose into eye/look/fov (see RELEASE_R): the lens at
   *  its bearing round the caster, looking up the diagonal, the field (and,
   *  past its widest, the distance) fitted to what it has to hold. */
  private releasePose(caster:Fighter,bulk:number){
    const p=this.pivot,c=caster.group.position,victim=this.releaseVictim?.state.alive?this.releaseVictim:undefined;
    const far=this.point;
    if(victim){const v=victim.group.position;far.set(v.x,v.y+1.1*bodyBulk(victim.state),v.z);}
    else far.set(p.x+Math.sin(this.facing)*RELEASE_AHEAD,p.y,p.z+Math.cos(this.facing)*RELEASE_AHEAD);
    const radius=this.overhead?this.chargeSphere(caster,this.castAge+this.t,this.charge):0;
    // The victim RELEASE_X of the half-width off centre on the far side from
    // the caster: a lens over the left shoulder has the caster on the right.
    const offset=-this.releaseGoalSide*Math.atan(RELEASE_X*Math.tan(THREE.MathUtils.degToRad(RELEASE_FOV)/2)*this.aspect);
    // As far out as it may stand: further for a charge overhead, and never
    // through a wall (the room behind the caster, as the charge framing
    // measures its own).
    const most=Math.max(RELEASE_R*bulk,Math.min((this.overhead?RELEASE_REACH_CHARGE:RELEASE_REACH)*bulk,this.clear(this.releaseAz,(this.overhead?RELEASE_REACH_CHARGE:RELEASE_REACH)*bulk,this.walls)));
    let r=Math.max(RELEASE_R*bulk,this.summonCount?this.releaseGoalReach:0),yaw=0,pitch=0,fov=RELEASE_FOV,need=0;
    for(let pass=0;pass<4;pass++){
      this.eye.set(p.x+Math.sin(this.releaseAz)*r,p.y+RELEASE_EYE*bulk,p.z+Math.cos(this.releaseAz)*r);
      yaw=Math.atan2(far.x-this.eye.x,far.z-this.eye.z)+offset;
      this.fitCount=0;this.fitSide=0;this.fitYaw=yaw;
      // The caster's head and chest - the rest of them may crop at the
      // knees, as the concept's does - the victim crown to feet (the feet
      // over the skill cards), the charge. Every crown under the HUD's bars.
      if(caster.state.fighter!=='basilissa'){
        this.fitPoint(c.x,c.y+1.9*bulk,c.z,1,RELEASE_TOP,1,false);this.fitPoint(p.x,p.y,p.z,.8,RELEASE_TOP,1,false);
      }
      if(victim){const v=victim.group.position,vb=bodyBulk(victim.state);this.fitPoint(v.x,v.y+1.9*vb,v.z,.85,RELEASE_TOP,1,false);this.fitPoint(v.x,v.y,v.z,.85,1,RELEASE_FEET,false);}
      // Boa's authored dismount rises above her grounded simulation capsule,
      // and the heel drop briefly inverts her silhouette. Frame the joints
      // actually being drawn instead of losing the attacker above the HUD.
      if(caster.state.fighter==='basilissa')for(const name of ['Head','LeftHand','RightHand','LeftFoot','RightFoot']){
        const joint=caster.drawnJoint(name);if(!joint)continue;
        joint.getWorldPosition(this.sightTo);
        this.fitPoint(this.sightTo.x,this.sightTo.y+.22*bulk,this.sightTo.z,.85,RELEASE_TOP,1,false);
      }
      // Storm Warning's subject includes the compact storm above the
      // victim. Keep its crown below the HUD, using the existing wall-aware
      // release fit, so the downward lightning remains in the same shot.
      if(caster.state.fighter==='sorayomi'&&victim){
        const y=victim.group.position.y+3.6,x=Math.cos(yaw)*1.4,z=-Math.sin(yaw)*1.4;
        this.fitPoint(far.x,y,far.z,.85,RELEASE_TOP,1,false);
        this.fitPoint(far.x+x,y-.65,far.z+z,.92,RELEASE_TOP,1,false);
        this.fitPoint(far.x-x,y-.65,far.z-z,.92,RELEASE_TOP,1,false);
      }
      // The charge: its centre must be in - the technique on the diagonal -
      // its top may crop; never the caster or the victim. Fitting all of it
      // stood the lens 7.5 m back and drew the fighters at a sixth of the
      // frame.
      if(this.overhead){this.fitPoint(this.charge.x,this.charge.y,this.charge.z,.9,RELEASE_TOP,1,false);this.fitPoint(this.charge.x,this.charge.y+radius*CHARGE_TOP,this.charge.z,.9,RELEASE_TOP,1,true);}
      // The least field whose pitch holds every point that may not crop
      // inside its own lines, halved for.
      let lo=Math.tan(THREE.MathUtils.degToRad(20)),hi=Math.tan(THREE.MathUtils.degToRad(60));
      for(let i=0;i<14;i++){const mid=(lo+hi)/2;if(this.pitchRange(mid,false))hi=mid;else lo=mid;}
      need=hi;
      const tall=THREE.MathUtils.radToDeg(2*Math.atan(hi)),wide=THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(Math.min(this.fitSide,1.4))/this.aspect));
      fov=Math.max(tall,wide);
      if(fov<=RELEASE_FOV_MOST||r>=most-1e-6)break;
      r=Math.min(most,r*fov/RELEASE_FOV_MOST);
    }
    this.fov=THREE.MathUtils.clamp(fov,RELEASE_FOV,RELEASE_FOV_MOST);
    // The pitch in the middle of those that hold everything; with too little
    // field for that, the highest that holds what may not crop, which shows
    // as much of the charge over it as there is room for.
    const half=Math.tan(THREE.MathUtils.degToRad(this.fov)/2);
    if(this.pitchRange(half,true))pitch=(this.fitFrom+this.fitTo)/2;
    else if(this.pitchRange(half,false))pitch=this.fitTo;
    else{this.pitchRange(need,false);pitch=(this.fitFrom+this.fitTo)/2;}
    const reach=Math.max(1,Math.hypot(far.x-this.eye.x,far.z-this.eye.z)*.6);
    this.look.set(this.eye.x+Math.sin(yaw)*Math.cos(pitch)*reach,this.eye.y+Math.sin(pitch)*reach,this.eye.z+Math.cos(yaw)*Math.cos(pitch)*reach);
  }
  /** One point the release shot must hold, seen from `eye` against the look's
   *  yaw: its elevation, to sit under `top` and over `bottom` of the
   *  half-height (see pitchRange), and its bearing off the yaw, over `share`
   *  of the half-width, which widens fitSide. */
  private fitPoint(x:number,y:number,z:number,share:number,top:number,bottom:number,soft:boolean){
    const dx=x-this.eye.x,dz=z-this.eye.z,flat=Math.hypot(dx,dz),k=this.fitCount++;
    this.fitEl[k]=Math.atan2(y-this.eye.y,Math.max(flat,.3));this.fitTop[k]=top;this.fitBottom[k]=bottom;this.fitSoft[k]=soft?1:0;
    this.fitSide=Math.max(this.fitSide,Math.atan(Math.tan(Math.min(Math.abs(wrapped(Math.atan2(dx,dz)-this.fitYaw)),1.4))/share));
  }
  /** The pitches from which a field of half-height tangent `half` holds every
   *  fitted point inside its lines (without `soft`, only those that may not
   *  crop), into fitFrom..fitTo; true when there are any. */
  private pitchRange(half:number,soft:boolean){
    let from=-Infinity,to=Infinity;
    for(let k=0;k<this.fitCount;k++){
      if(!soft&&this.fitSoft[k])continue;
      const el=this.fitEl[k];
      from=Math.max(from,el-Math.atan(this.fitTop[k]*half));to=Math.min(to,el+Math.atan(this.fitBottom[k]*half));
    }
    this.fitFrom=from;this.fitTo=to;
    return from<=to;
  }
  /** The close-up blended `u` of the way into the release shot, in polar
   *  terms round the caster: heroEye/heroLook/heroFov toward eye/look/fov. */
  private between(u:number){
    const p=this.pivot,azA=Math.atan2(this.heroEye.x-p.x,this.heroEye.z-p.z),azB=Math.atan2(this.eye.x-p.x,this.eye.z-p.z);
    const short=wrapped(azB-azA),turn=this.swingLong?short-Math.sign(short||1)*Math.PI*2:short;
    const az=azA+turn*u,r=THREE.MathUtils.lerp(Math.hypot(this.heroEye.x-p.x,this.heroEye.z-p.z),Math.hypot(this.eye.x-p.x,this.eye.z-p.z),u);
    const y=THREE.MathUtils.lerp(this.heroEye.y,this.eye.y,u);
    this.eye.set(p.x+Math.sin(az)*r,y,p.z+Math.cos(az)*r);
    this.look.lerpVectors(this.heroLook,this.look,u);this.fov=THREE.MathUtils.lerp(this.heroFov,this.fov,u);
  }
  /** The least air, in metres from their axis less their radius, that the
   *  swing from the close-up (heroEye) to the release pose (eye) leaves
   *  round any body but the caster, the short way round or the long;
   *  sampled SWING_SAMPLES times. */
  private swingClearance(long:boolean){
    if(!this.crowd)return Infinity;
    const p=this.pivot,azA=Math.atan2(this.heroEye.x-p.x,this.heroEye.z-p.z),azB=Math.atan2(this.eye.x-p.x,this.eye.z-p.z),short=wrapped(azB-azA),turn=long?short-Math.sign(short||1)*Math.PI*2:short;
    const rA=Math.hypot(this.heroEye.x-p.x,this.heroEye.z-p.z),rB=Math.hypot(this.eye.x-p.x,this.eye.z-p.z);
    this.pathLeast=Infinity;
    for(let i=1;i<=SWING_SAMPLES;i++){
      const w=i/(SWING_SAMPLES+1),az=azA+turn*w,r=THREE.MathUtils.lerp(rA,rB,w);
      this.nearFrom.set(p.x+Math.sin(az)*r,THREE.MathUtils.lerp(this.heroEye.y,this.eye.y,w),p.z+Math.cos(az)*r);
      this.crowd.forEach(this.pathAir);
    }
    return this.pathLeast;
  }
  private pathLeast=Infinity;private swingLong=false;
  /** Round 3d (ULTS): the ultimate on screen is a hit-confirm cinematic (see
   *  `cinematic`), and the cast whose confirm started it. */
  private cine=false;private cineKey:number=NaN;
  /** This frame's gameplay look, which the opener's push-in keeps. */
  private gameLook=new THREE.Vector3();
  private gameLens=50;private frameDt=0;
  private pathAir=(body:Fighter)=>{
    if(body===this.subject||!body.state.alive||!body.group.visible)return;
    const q=body.group.position,bulk=drawnBulk(body),e=this.nearFrom;
    if(e.y>q.y+BODY_HEIGHT*bulk+LENS_CLEAR)return;
    this.pathLeast=Math.min(this.pathLeast,Math.hypot(e.x-q.x,e.z-q.z)-BODY_RADIUS*bulk);
  };
  /** How long a swing between the lens `other` and the shot's pose takes: at
   *  least `base`, as long as the lens's travel needs (see LENS_SPEED), and
   *  stretched for the way round it goes (see SWING), whichever is longest. */
  private travel(base:number,other:THREE.Vector3){
    const p=this.pivot,angle=Math.abs(wrapped(Math.atan2(this.eye.x-p.x,this.eye.z-p.z)-Math.atan2(other.x-p.x,other.z-p.z)));
    return Math.max(this.lensSwing(base,other),Math.min(SWING_LONGEST,base*THREE.MathUtils.clamp(angle/SWING,1,SWING_MOST)));
  }
  /** Set up the impact shot on `victim` (see IMPACT_ANGLE): its bearing, on
   *  the lens's side of the line back to the caster where the victim can be
   *  seen from, and how it comes in. */
  private impact(victim:Fighter,caster:Fighter|undefined,eye:THREE.Vector3|undefined,bulk:number){
    this.setPivot(victim,bulk,'impact');
    const p=this.pivot,bridged=this.kind!=='none'&&this.weight>1e-3,from=bridged?this.shownEye:eye??this.scratch.set(p.x,p.y+1,p.z-4);
    const fromAz=Math.atan2(from.x-p.x,from.z-p.z),back=caster?Math.atan2(caster.group.position.x-p.x,caster.group.position.z-p.z):fromAz;
    // Round 3c: the floor they are thrown from (see IMPACT_TOP), and not down yet.
    this.impactFloor=caster?Math.min(caster.group.position.y,victim.group.position.y):victim.group.position.y;this.impactDownAt=-1;this.impactFlew=false;
    const side=wrapped(fromAz-back)>=0?1:-1,r=IMPACT_R*bulk,height=p.y+this.impactEye(bulk);
    this.impactAz=back+side*IMPACT_ANGLE;
    // This side, wider on it, the other side, wider on that: the first that
    // sees them past everybody else - and, of those, the first with room from
    // the walls where the victim is headed (see IMPACT_AHEAD).
    this.predictAhead(victim,caster);
    if(caster)this.summonsFor(caster,caster.state.actionTime*caster.state.actionDuration);
    // Round 3b: nor with somebody else filling the frame (see CROWD_MOST) -
    // the caster included: the shot is the victim's.
    let seen=NaN,best=Infinity;
    for(let k=0;k<4;k++){
      const az=back+(k<2?side:-side)*(k%2?IMPACT_WIDE:IMPACT_ANGLE);
      if(!this.seesFrom(az,r,height,victim,bulk))continue;
      this.probeEye.set(p.x+Math.sin(az)*r,height,p.z+Math.cos(az)*r);
      const crowd=this.inSummon(this.probeEye)?1:this.crowdCover(this.probeEye,p,IMPACT_FOV,victim);
      const roomy=this.roomAt(az,r)>=r*IMPACT_ROOM;
      if(roomy&&crowd<=CROWD_MOST){seen=az;break;}
      // Otherwise the least bad, a wall in the way weighing as a crowd would.
      const score=crowd+(roomy?0:.3)+k*.01;
      if(score<best){best=score;seen=az;}
    }
    if(Number.isFinite(seen))this.impactAz=seen;
    this.impactGoal=this.impactAz;this.impactTurn=0;this.drawnOffset.set(0,0,0);this.impactFit=IMPACT_FOV;
    this.eye.set(p.x+Math.sin(this.impactAz)*r,height,p.z+Math.cos(this.impactAz)*r);
    // The victim is thrown metres while the lens comes over, so the carry
    // from the release shot is never shorter than IMPACT_CARRY.
    const swing=this.travel(IMPACT_IN,from);
    this.impactIn=bridged?0:swing;this.impactCarry=bridged?Math.max(IMPACT_CARRY,swing):CARRY;
    this.impactLead=bridged?this.impactCarry:this.impactIn;this.out=IMPACT_OUT;
    this.length=this.impactHold()+IMPACT_OUT;
  }
  /** How much longer than planned the close shot's swing between the lens
   *  `other` and the shot's bearing takes (see SWING). */
  private stretch(other:THREE.Vector3){
    return THREE.MathUtils.clamp(Math.abs(wrapped(this.heroAz-Math.atan2(other.x-this.pivot.x,other.z-this.pivot.z)))/SWING,1,SWING_MOST);
  }
  /** How long a swing between the lens `other` and the shot's own pose
   *  (`eye`) takes, at least `base`: see LENS_SPEED. The travel is taken at
   *  the wider of the two radii, where the orbit moves the lens fastest. */
  private lensSwing(base:number,other:THREE.Vector3){
    const p=this.pivot,rA=Math.hypot(other.x-p.x,other.z-p.z),rB=Math.hypot(this.eye.x-p.x,this.eye.z-p.z);
    const angle=Math.abs(wrapped(Math.atan2(this.eye.x-p.x,this.eye.z-p.z)-Math.atan2(other.x-p.x,other.z-p.z)));
    return THREE.MathUtils.clamp(1.875*Math.hypot(angle*Math.max(rA,rB),rB-rA,this.eye.y-other.y)/LENS_SPEED,base,SWING_LONGEST);
  }
  /** Whether the swing from the gameplay lens at `from` into framing
   *  `framing` on side `side` keeps the caster in sight: the polar blend
   *  `present` will draw, sampled through its middle. */
  private swingClear(subject:Fighter,framing:number,side:number,bulk:number,from:THREE.Vector3){
    const p=this.pivot;
    this.heroPose(subject,HERO_IN,framing,this.facing+side*HERO_FRAMINGS[framing].angle,bulk);
    return this.swingSees(subject,bulk,from,Math.atan2(this.eye.x-p.x,this.eye.z-p.z),Math.hypot(this.eye.x-p.x,this.eye.z-p.z),this.eye.y);
  }
  /** Whether the polar blend `present` draws from the lens `from` to the pose
   *  at azimuth `az`, `r` out and `height` up round the pivot keeps `subject`
   *  in sight - which a lens passing through somebody does not. Sampled
   *  through its middle. */
  private swingSees(subject:Fighter,bulk:number,from:THREE.Vector3,az:number,r:number,height:number){
    const p=this.pivot,azG=Math.atan2(from.x-p.x,from.z-p.z),rG=Math.hypot(from.x-p.x,from.z-p.z);
    for(let i=1;i<=SWING_SAMPLES;i++){
      const w=i/(SWING_SAMPLES+1),a=azG+wrapped(az-azG)*w,reach=THREE.MathUtils.lerp(rG,r,w),y=THREE.MathUtils.lerp(from.y,height,w);
      if(!this.seesFrom(a,reach,y,subject,bulk))return false;
      // Nor through anybody: the keep-out would crane it over their head.
      this.nearFrom.set(p.x+Math.sin(a)*reach,y,p.z+Math.cos(a)*reach);
      if(this.lensNearBody(subject))return false;
    }
    return true;
  }
  /** Whether a lens at `nearFrom` is inside the keep-out round anybody but
   *  `subject` (see LENS_CLEAR). */
  private lensNearBody(subject:Fighter){
    if(!this.crowd)return false;
    this.nearSkip=subject;this.nearHit=false;this.crowd.forEach(this.bodyNear);this.nearSkip=undefined;
    return this.nearHit;
  }
  private bodyNear=(body:Fighter)=>{
    if(this.nearHit||body===this.nearSkip||!body.state.alive||!body.group.visible)return;
    const q=body.group.position,bulk=bodyBulk(body.state),e=this.nearFrom;
    if(e.y<q.y+BODY_HEIGHT*bulk+LENS_CLEAR&&Math.hypot(e.x-q.x,e.z-q.z)<BODY_RADIUS*bulk+LENS_CLEAR)this.nearHit=true;
  };
  /** How long framing `framing` on side `side` keeps the caster in sight:
   *  the shot sampled from the moment it owns most of the frame to its end.
   *  Infinity when it never loses them. */
  private seenFor(subject:Fighter,framing:number,side:number,bulk:number){
    const samples=6;
    for(let i=0;i<=samples;i++){
      const t=this.length*(.2+.8*i/samples);
      this.heroPose(subject,t,framing,this.facing+side*HERO_FRAMINGS[framing].angle,bulk);
      if(!this.sees(this.eye,subject,bulk,t))return i===0?0:this.length*(.2+.8*(i-1)/samples);
    }
    return Infinity;
  }
  /** The hero shot's own pose `t` seconds in, into eye/look/fov: framing
   *  `framing`, the lens at bearing `az` round the caster. An overhead charge
   *  stands the lens back and tilts it up to hold the charge as well (see
   *  CHARGE_FOV); anything else is the push-in on the caster. */
  private heroPose(subject:Fighter,t:number,framing:number,az:number,bulk:number){
    const f=HERO_FRAMINGS[framing],p=this.pivot,eyeY=p.y+f.eye*bulk;
    if(this.overhead){
      const radius=this.chargeSphere(subject,this.castAge+t,this.charge);
      this.fitCharge(az,eyeY,HERO_FROM*bulk,subject.group.position.y-.1,this.charge.y+radius*CHARGE_TOP+.15,this.clear(az,CHARGE_REACH,this.walls));
      const r=this.fitR;
      this.eye.set(p.x+Math.sin(az)*r,eyeY,p.z+Math.cos(az)*r);
      this.look.set(p.x,eyeY+r*Math.tan(this.fitPitch),p.z);this.fov=this.fitFov;
      return;
    }
    const r=THREE.MathUtils.lerp(f.from,f.to,ease(t/this.planned))*bulk;
    this.eye.set(p.x+Math.sin(az)*r,eyeY,p.z+Math.cos(az)*r);
    this.look.copy(p).y+=HERO_LOOK*bulk;this.fov=HERO_FOV;
  }
  /** Turn the hero shot's bearing toward `front` (the body's front three-
   *  quarter) as far as the caster stays in sight on the way (see TURN_STEP);
   *  if they are already hidden, toward the nearest bearing that sees them.
   *  From the pose just placed. True when the bearing moved. */
  private turnHero(subject:Fighter,bulk:number,step:number,front:number){
    const p=this.pivot,r=Math.hypot(this.eye.x-p.x,this.eye.z-p.z),height=this.eye.y,here=this.heroAz;
    let goal=here;
    if(this.seesFrom(here,r,height,subject,bulk)){
      this.blocked=0;
      // Toward the front, stopping short of the first bearing that loses them.
      const want=wrapped(front-here),way=Math.sign(want),span=Math.abs(want);goal=here+want;
      for(let k=1;(k-1)*TURN_STEP<span;k++){
        const o=Math.min(k*TURN_STEP,span);
        if(!this.seesFrom(here+way*o,r,height,subject,bulk)){goal=here+way*Math.max(0,(k-1)*TURN_STEP);break;}
      }
    }else{
      // Hidden where it stands: out to the nearest bearing that sees them,
      // the front's way first.
      const way=wrapped(front-here)<0?-1:1;let found=false;
      for(let k=1;k*TURN_STEP<=TURN_SEARCH&&!found;k++){
        if(this.seesFrom(here+way*k*TURN_STEP,r,height,subject,bulk)){goal=here+way*k*TURN_STEP;found=true;}
        else if(this.seesFrom(here-way*k*TURN_STEP,r,height,subject,bulk)){goal=here-way*k*TURN_STEP;found=true;}
      }
      if(found)this.blocked=0;else{this.blocked+=step;goal=here+wrapped(front-here);}
    }
    if(this.blocked>BLOCKED_GRACE)this.cancel(INTERRUPT);
    // The heading assist's integrator: speed and acceleration limited,
    // braking to arrive; a wide shot's lens travels further per radian.
    const speed=Math.min(TURN_SPEED,TURN_REACH/Math.max(r,1e-3));
    for(let left=step;left>1e-9;left-=1/120){
      const h=Math.min(1/120,left),error=goal-this.heroAz,size=Math.abs(error);
      const wanted=Math.sign(error)*Math.min(speed,Math.sqrt(1.8*TURN_ACCEL*size),TURN_GAIN*size);
      this.heroTurn+=THREE.MathUtils.clamp(wanted-this.heroTurn,-TURN_ACCEL*h,TURN_ACCEL*h);
      this.heroAz+=this.heroTurn*h;
    }
    return this.heroAz!==here;
  }
  /** Round 3c: the impact lens's height over the pivot - IMPACT_EYE, but
   *  never more than IMPACT_TOP over the floor the victim was thrown from. */
  private impactEye(bulk:number){return Math.min(IMPACT_EYE*bulk,this.impactFloor+IMPACT_TOP*Math.max(1,bulk)-this.pivot.y);}
  /** Round 3c: when the impact shot's hold ends - IMPACT_HOLD after the carry
   *  at least, and IMPACT_DOWN after the victim is down (see IMPACT_TOP),
   *  never waiting past IMPACT_AIR of the carry for that. */
  private impactHold(){
    const down=this.impactDownAt>=0?this.impactDownAt:Infinity;
    return Math.max(this.impactLead+IMPACT_HOLD,Math.min(down,this.impactLead+IMPACT_AIR)+IMPACT_DOWN);
  }
  private impactFlew=false;
  /** Where the victim will be IMPACT_AHEAD seconds from now, into `ahead`:
   *  the pivot carried along the body's travel over the floor. */
  private predictAhead(body:Fighter,thrower?:Fighter){
    this.ahead.copy(this.pivot);
    const v=body.velocity;
    if(v)this.scratch.set(v.x,0,v.z).multiplyScalar(IMPACT_AHEAD);else this.scratch.set(0,0,0);
    // Not moving yet: thrown on from whoever threw them.
    if(thrower&&this.scratch.lengthSq()<.25){
      const t=thrower.group.position,p=body.group.position;this.scratch.set(p.x-t.x,0,p.z-t.z);
      if(this.scratch.lengthSq()>1e-6)this.scratch.setLength(IMPACT_THROW);
    }
    if(this.scratch.lengthSq()>IMPACT_AHEAD_MOST*IMPACT_AHEAD_MOST)this.scratch.setLength(IMPACT_AHEAD_MOST);
    // No further than the wall they will be stopped by: from behind it every
    // bearing is out of room.
    const reach=this.scratch.length();
    if(reach>1e-4&&this.walls.length){
      this.ray.set(this.pivot,this.scratch.divideScalar(reach));this.ray.far=reach+CLEARANCE;
      this.hits.length=0;this.ray.intersectObjects(this.walls as THREE.Object3D[],true,this.hits);
      this.ahead.addScaledVector(this.scratch,this.hits.length?Math.max(0,this.hits[0].distance-CLEARANCE):reach);
    }else this.ahead.add(this.scratch);
  }
  /** The room a lens at bearing `az` has from `ahead`, down the bearing and
   *  either side of it (see IMPACT_CONE). */
  private roomAt(az:number,want:number){
    return Math.min(this.clear(az,want,this.walls,this.ahead),this.clear(az-IMPACT_CONE,want,this.walls,this.ahead),this.clear(az+IMPACT_CONE,want,this.walls,this.ahead));
  }
  /** Carry the pivot from the root onto the body as drawn (see IMPACT_DRAWN):
   *  the offset between the two is what is eased, so the root's own flight is
   *  followed exactly and only a tumble's swing is smoothed. */
  private followDrawn(subject:Fighter,step:number){
    const drawn=subject as unknown as {visualCenter?:(out:THREE.Vector3)=>THREE.Vector3};
    if(typeof drawn.visualCenter!=='function')return;
    drawn.visualCenter(this.drawnPoint).sub(this.pivot);
    if(this.drawnPoint.lengthSq()>4)this.drawnPoint.setLength(2);
    this.drawnOffset.lerp(this.drawnPoint,blend(IMPACT_DRAWN,step));
    this.pivot.add(this.drawnOffset);
  }
  /** Steer the impact shot's bearing clear of the walls where the victim is
   *  headed (see IMPACT_AHEAD): a new goal is chosen only when the one it is
   *  making for has no room, and the bearing follows it at the hero bearing's
   *  own limits, so it arrives rather than hunting. */
  private turnImpact(subject:Fighter,bulk:number,step:number){
    const r=IMPACT_R*bulk,want=r*IMPACT_ROOM,height=this.pivot.y+this.impactEye(bulk);
    if(this.walls.length){
      this.predictAhead(subject);
      if(this.roomAt(this.impactGoal,r)<want){
        // The nearest bearing with room that still sees them, the way the
        // turn is already going first; with none, the roomiest in reach.
        const way=this.impactTurn<0?-1:1;let found=false,best=-1,roomiest=this.impactGoal;
        for(let k=1;k*IMPACT_STEP<=IMPACT_SEARCH&&!found;k++)for(let side=0;side<2&&!found;side++){
          const az=this.impactGoal+(side?-way:way)*k*IMPACT_STEP,room=this.roomAt(az,r);
          if(room>=want&&this.seesFrom(az,r,height,subject,bulk)){this.impactGoal=az;found=true;}
          else if(room>best){best=room;roomiest=az;}
        }
        if(!found)this.impactGoal=roomiest;
      }
    }
    // Eased in over the shot's first IMPACT_EASE seconds: the turn begins as
    // the blow lands, on a lens already carrying the release shot's swing.
    const ease=IMPACT_EASE_FLOOR+(1-IMPACT_EASE_FLOOR)*THREE.MathUtils.smoothstep(this.t,0,IMPACT_EASE),accel=TURN_ACCEL*ease;
    const speed=Math.min(TURN_SPEED,TURN_REACH/Math.max(r,1e-3));
    for(let left=step;left>1e-9;left-=1/120){
      const h=Math.min(1/120,left),error=this.impactGoal-this.impactAz,size=Math.abs(error);
      const wanted=Math.sign(error)*Math.min(speed,Math.sqrt(1.8*accel*size),TURN_GAIN*size);
      this.impactTurn+=THREE.MathUtils.clamp(wanted-this.impactTurn,-accel*h,accel*h);
      this.impactAz+=this.impactTurn*h;
    }
  }
  /** The field, in degrees, that holds all of `body` - crown to soles, as
   *  drawn - inside IMPACT_FILL of the frame from a lens at `eye` looking at
   *  `look`; never under IMPACT_FOV or over IMPACT_FOV_MOST. */
  private fieldFor(body:Fighter,eye:THREE.Vector3,look:THREE.Vector3){
    const lx=look.x-eye.x,ly=look.y-eye.y,lz=look.z-eye.z,ll=Math.hypot(lx,ly,lz)||1,joints=body.joints,p=body.group.position;
    let most=0,found=false;
    for(let i=0;i<FIT_JOINTS.length;i++){
      const bone=joints?.get(FIT_JOINTS[i]);if(!bone)continue;
      bone.getWorldPosition(this.drawnPoint);if(i===0)this.drawnPoint.y+=.24*bodyBulk(body.state);
      most=Math.max(most,this.offLook(eye,lx,ly,lz,ll));found=true;
    }
    if(!found){
      this.drawnPoint.copy(p);most=this.offLook(eye,lx,ly,lz,ll);
      this.drawnPoint.y+=1.9*bodyBulk(body.state);most=Math.max(most,this.offLook(eye,lx,ly,lz,ll));
    }
    return THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(Math.min(most,1.4))/IMPACT_FILL)),IMPACT_FOV,IMPACT_FOV_MOST);
  }
  /** The field that holds the winner's head (and a little over it) and both hands within VICTORY_FILL of the half-field
   *  from `eye` looking at `look`. */
  private victoryField(body:Fighter,eye:THREE.Vector3,look:THREE.Vector3){
    const lx=look.x-eye.x,ly=look.y-eye.y,lz=look.z-eye.z,ll=Math.hypot(lx,ly,lz)||1,joints=body.joints,bulk=bodyBulk(body.state);
    let most=0;
    for(let i=0;i<VICTORY_FIT.length;i++){
      const bone=joints?.get(VICTORY_FIT[i]);if(!bone)continue;
      bone.getWorldPosition(this.drawnPoint);this.drawnPoint.y+=(i===0?.24:.1)*bulk;
      most=Math.max(most,this.offLook(eye,lx,ly,lz,ll));
    }
    return THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(Math.min(most,1.4))/VICTORY_FILL)),VICTORY_FOV,VICTORY_FOV_MOST);
  }
  /** How far off the look (whose direction is lx, ly, lz, ll long) the point
   *  in `drawnPoint` is, in radians, from `eye`. */
  private offLook(eye:THREE.Vector3,lx:number,ly:number,lz:number,ll:number){
    const dx=this.drawnPoint.x-eye.x,dy=this.drawnPoint.y-eye.y,dz=this.drawnPoint.z-eye.z,d=Math.hypot(dx,dy,dz)||1;
    return Math.acos(THREE.MathUtils.clamp((dx*lx+dy*ly+dz*lz)/(d*ll),-1,1));
  }
  /** Whether a lens `r` out from the pivot at azimuth `az`, `height` up, sees
   *  the caster now. */
  private seesFrom(az:number,r:number,height:number,subject:Fighter,bulk:number){
    const p=this.pivot;this.scratch.set(p.x+Math.sin(az)*r,height,p.z+Math.cos(az)*r);
    return this.sees(this.scratch,subject,bulk,0);
  }
  /** The charge `age` seconds into the cast: its centre into `out`, its
   *  radius returned (see OVERHEAD). */
  private chargeSphere(subject:Fighter,age:number,out:THREE.Vector3){
    const state=subject.state,p=subject.group.position,charge=THREE.MathUtils.clamp(age/Math.max(this.release,1e-3),0,1);
    if(state.fighter==='konta'){
      const size=KONTA_BOMB*(.14+.86*Math.pow(charge,.8));
      // The rig's hands (or the fox's mouth), as CombatEffects asks it; a
      // body without one holds the sphere up over its head.
      if(typeof subject.chargePosition==='function')subject.chargePosition(out);else out.set(p.x,p.y+2.1,p.z);
      if(!state.awakened)out.y+=size+.1;
      return size;
    }
    const at=OVERHEAD[state.fighter]??BOMB;out.set(p.x,p.y+at.height,p.z);
    return at.radius*(at.from+(1-at.from)*Math.pow(charge,at.power));
  }
  /** The distance, pitch and field that hold `feet` and `top` from a lens
   *  `eyeY` high at azimuth `az` round the pivot, with `room` metres clear
   *  that way (see CHARGE_FOV): the least distance that fits CHARGE_FOV,
   *  found by halving (the span only narrows as the lens backs away), rounded
   *  onto `nearest` and kept inside the room; a field widened as far as that
   *  needs; and the pitch in the middle of those that hold both - or, when
   *  none does, the one that holds the feet. Into fitR, fitPitch, fitFov. */
  private fitCharge(az:number,eyeY:number,nearest:number,feet:number,top:number,room:number){
    const p=this.pivot,c=this.charge,ux=Math.sin(az),uz=Math.cos(az),share=1-CHARGE_TOP_EDGE-CHARGE_FOOT_EDGE,usable=THREE.MathUtils.degToRad(CHARGE_FOV)*share;
    let lo=.5,hi=CHARGE_REACH;
    for(let i=0;i<18;i++){
      const mid=(lo+hi)/2,toCharge=Math.hypot(p.x+ux*mid-c.x,p.z+uz*mid-c.z);
      if(Math.atan2(top-eyeY,toCharge)-Math.atan2(feet-eyeY,mid)>usable)lo=mid;else hi=mid;
    }
    const r=Math.max(MIN_REACH,Math.min(CHARGE_REACH,softMax(nearest,hi,.8),room)),toCharge=Math.hypot(p.x+ux*r-c.x,p.z+uz*r-c.z);
    const up=Math.atan2(top-eyeY,toCharge),down=Math.atan2(feet-eyeY,r);
    const fov=THREE.MathUtils.clamp(THREE.MathUtils.radToDeg((up-down)/share),CHARGE_FOV,CHARGE_FOV_MOST),half=THREE.MathUtils.degToRad(fov)/2;
    const lowest=up-half+2*half*CHARGE_TOP_EDGE,highest=down+half-2*half*CHARGE_FOOT_EDGE;
    this.fitR=r;this.fitFov=fov;this.fitPitch=lowest<=highest?(lowest+highest)/2:highest;
  }
  /** Whether a lens at `eye` sees `subject`'s chest and head past every other
   *  living body, as they will stand `ahead` seconds from now. */
  private sees(eye:THREE.Vector3,subject:Fighter,bulk:number,ahead:number){
    const crowd=this.crowd,bodies=!!crowd&&crowd.size>1;
    if(!bodies&&!this.summonCount)return true;
    const p=subject.group.position;
    this.sightFrom.copy(eye);this.sightSubject=subject;this.sightAhead=Math.min(ahead,PREDICT);this.sightBlocked=false;
    // Round 3b: past the summons too (see GUARDIAN_BACK).
    this.sightTo.set(p.x,p.y+1.1*bulk,p.z);if(bodies)crowd!.forEach(this.blocks);if(!this.sightBlocked)this.sightBlocked=this.summonBlocks();
    if(!this.sightBlocked){this.sightTo.set(p.x,p.y+1.62*bulk,p.z);if(bodies)crowd!.forEach(this.blocks);if(!this.sightBlocked)this.sightBlocked=this.summonBlocks();}
    this.sightSubject=undefined;
    return !this.sightBlocked;
  }
  private blocks=(body:Fighter)=>{
    if(this.sightBlocked||body===this.sightSubject||!body.state.alive||!body.group.visible)return;
    const p=body.group.position,v=body.velocity,ahead=this.sightAhead,bulk=drawnBulk(body),radius=BODY_RADIUS*bulk;
    const x=p.x+(v?v.x*ahead:0),z=p.z+(v?v.z*ahead:0);
    if(sightClearance(this.sightFrom,this.sightTo,x,z,p.y+radius,p.y+BODY_HEIGHT*bulk-radius,radius+SIGHT_CLEAR)<radius+SIGHT_CLEAR)this.sightBlocked=true;
  };
  /** Whether the victory orbit on side `side` keeps sight of the winner, on
   *  the swing in from the lens `from` as well unless the orbit cuts in. */
  private orbitClear(winner:Fighter,side:number,from:THREE.Vector3,turn=this.victoryTurn){
    const size=bodyBulk(winner.state),r=VICTORY_RADIUS*size,height=this.pivot.y+VICTORY_EYE*size;
    for(let i=0;i<=4;i++){
      const az=this.facing+side*(VICTORY_ANGLE+turn+.6*i/4);
      this.scratch.set(this.pivot.x+Math.sin(az)*r,height,this.pivot.z+Math.cos(az)*r);
      if(!this.sees(this.scratch,winner,size,0))return false;
    }
    return this.opening||this.swingSees(winner,size,from,this.facing+side*(VICTORY_ANGLE+turn),r,height);
  }
  /** The share of the victory orbit's reach clear of the walls all along it, on side `side` turned by `turn`. */
  private orbitRoom(winner:Fighter,side:number,turn:number){
    const r=VICTORY_RADIUS*bodyBulk(winner.state);let room=1;
    for(let i=0;i<=4;i++)room=Math.min(room,this.clear(this.facing+side*(VICTORY_ANGLE+turn+.6*i/4),r,this.walls)/r);
    return room;
  }
  /** Whether the countdown's sweep on side `side` keeps sight of the player,
   *  on the swing in from the lens `from` as well. */
  private sweepClear(player:Fighter,side:number,from?:THREE.Vector3){
    for(let i=0;i<=4;i++){
      const u=i/4,az=this.facing+side*(INTRO_FRONT+.3*u),r=INTRO_RADIUS-.8*u;
      this.scratch.set(this.pivot.x+Math.sin(az)*r,this.pivot.y+.15,this.pivot.z+Math.cos(az)*r);
      if(!this.sees(this.scratch,player,1,0))return false;
    }
    return this.opening||!from||this.swingSees(player,1,from,this.facing+side*INTRO_FRONT,INTRO_RADIUS,this.pivot.y+.15);
  }
  private setPivot(subject:Fighter,bulk:number,kind=this.kind){
    const p=subject.group.position;
    this.pivot.set(p.x,p.y+(kind==='ko'?.9:kind==='awaken'?1.2:1.1)*(kind==='awaken'?1:bulk),p.z);
  }
  /** Round 3f (CAM5): the heads the awakening frames (see AWAKEN_AT) as they
   *  stand this frame - the fighter's own into awakenOwn, and a form's
   *  standing in for the body into awakenFormAt - and the top of the
   *  silhouette over them into awakenCrown. */
  private drawnHeads(subject:Fighter){
    const p=subject.group.position,own=subject.joints?.get('Head'),point=this.awakenPoint;
    if(own)own.getWorldPosition(this.awakenOwn);else this.awakenOwn.set(p.x,p.y+1.62,p.z);
    point.copy(this.awakenOwn);
    // A form standing in for the body (Full Swell, NIGHTFALL, RAKSHASA, the
    // HOUND ARMOR, Kurobi), gone over to round the swap (see
    // AWAKEN_FORM_LEAD): its head bone, found under the fighter but not under
    // the fighter's own model - there while the form is hidden, in its rest
    // pose - raised to the fighter's own height if it is lower (the fox prowls).
    if(this.awakenForm>0){
      if(this.awakenBoneOf!==subject.group){
        this.awakenBone=undefined;this.awakenBoneOf=subject.group;
        const def=AWAKENINGS[subject.state.fighter];
        if(def?.kind==='form'&&def.formTint===undefined&&subject.model){this.findUnder=subject.model;subject.group.traverse(this.findHead);this.findUnder=undefined;}
      }
      if(this.awakenBone){
        this.awakenBone.getWorldPosition(this.awakenFormAt);this.awakenFormAt.y=Math.max(this.awakenFormAt.y,this.awakenOwn.y);
        point.lerp(this.awakenFormAt,this.awakenForm);
      }
    }
    // What stands over the crown: a looming spirit's crown - a body, held in
    // the frame with its user. (Not a blade thrown up: only a body is.) Held
    // under AWAKEN_CROWN_MOST over the head as it stands, so a crouch does not
    // take the spirit out of the reckoning.
    let top=point.y+AWAKEN_CROWN;const most=Math.max(point.y,p.y+AWAKEN_STANDING)+AWAKEN_CROWN_MOST;
    const loom=loomTop(subject.state.id);
    if(loom>0)top=Math.max(top,Math.min(p.y+loom+AWAKEN_STAND_CROWN,most));
    this.awakenCrown.set(point.x,top,point.z);
    this.awakenExcessGoal=Math.max(0,top-point.y-AWAKEN_CROWN);
  }
  private findUnder?:THREE.Object3D;
  private findHead=(object:THREE.Object3D)=>{
    if(this.awakenBone||!(object as THREE.Bone).isBone||!/^head$/i.test(object.name))return;
    for(let o:THREE.Object3D|null=object;o;o=o.parent)if(o===this.findUnder)return;
    this.awakenBone=object;
  };
  /** How far over to its form the awakening frames the fighter (see
   *  AWAKEN_FORM_LEAD), 0..1, on the shot's clock. */
  private formShare(state:{fighter:FighterId;awakened?:boolean}){
    if(!state.awakened)return 0;
    const swap=awakeningSwapAt(state.fighter);
    return THREE.MathUtils.smoothstep(this.awakenClock,swap-AWAKEN_FORM_LEAD,swap+AWAKEN_FORM_LAG);
  }
  /** The point framed (into awakenHead): each head as drawn followed on its
   *  own critically damped spring (see AWAKEN_TRACK) - what the springs take
   *  out is the pose's straining and snapping - and gone over from the
   *  fighter's to the form's by the share exactly; raised halfway to what
   *  stands over it, and kept within reach of the root. */
  private followHead(subject:Fighter){
    this.drawnHeads(subject);
    const dt=Math.min(this.frameDt,.1);
    this.spring(this.awakenOwnFollow,this.awakenOwnV,this.awakenOwn,dt);
    const x=this.awakenHead.copy(this.awakenOwnFollow);
    if(this.awakenForm>0&&this.awakenBone){
      if(!this.awakenFormSeen){this.awakenFormSeen=true;this.awakenFormFollow.copy(this.awakenFormAt);this.awakenFormV.set(0,0,0);}
      else this.spring(this.awakenFormFollow,this.awakenFormV,this.awakenFormAt,dt);
      x.lerp(this.awakenFormFollow,this.awakenForm);
    }
    // What stands over the head, eased (the silhouette is sampled ten times a
    // second), raises the point framed halfway to it (see AWAKEN_TALL).
    this.awakenExcess+=(this.awakenExcessGoal-this.awakenExcess)*blend(AWAKEN_EXCESS_RATE,dt);
    x.y+=this.awakenExcess*.5;
    // Within AWAKEN_REACH of the root (times the size): a power-up that
    // lunges (Gaunt' two metres) is watched from where the fighter stands.
    const p=subject.group.position,dx=x.x-p.x,dz=x.z-p.z,d=Math.hypot(dx,dz),reach=AWAKEN_REACH*Math.max(1,this.awakenSize,1+(bodyBulk(subject.state)-1)*this.awakenForm);
    if(d>reach){x.x=p.x+dx/d*reach;x.z=p.z+dz/d*reach;}
    this.awakenCrown.x=x.x;this.awakenCrown.z=x.z;
  }
  /** One head's follow (see AWAKEN_TRACK): critically damped, in real time
   *  and substeps, no faster than AWAKEN_TRACK_MOST metres a second; a jump
   *  of metres (a teleport) is a cut. */
  private spring(x:THREE.Vector3,v:THREE.Vector3,goal:THREE.Vector3,dt:number){
    if(x.distanceToSquared(goal)>4){x.copy(goal);v.set(0,0,0);return;}
    const k=1/AWAKEN_TRACK;
    for(let left=dt;left>1e-9;left-=1/120){
      const h=Math.min(1/120,left);
      v.x+=(k*k*(goal.x-x.x)-2*k*v.x)*h;v.y+=(k*k*(goal.y-x.y)-2*k*v.y)*h;v.z+=(k*k*(goal.z-x.z)-2*k*v.z)*h;
      // No faster than AWAKEN_TRACK_MOST: a pose that snaps is panned to.
      const speed=v.length();if(speed>AWAKEN_TRACK_MOST)v.multiplyScalar(AWAKEN_TRACK_MOST/speed);
      x.addScaledVector(v,h);
    }
  }
  /** How much bigger than a body the silhouette stands (see
   *  AWAKEN_SIZE_RATE): its crown over a body's. */
  private crownSize(subject:Fighter){
    return THREE.MathUtils.clamp((this.awakenCrown.y-subject.group.position.y)/CROWN_HEIGHT,1,AWAKEN_SIZE_MOST);
  }
  /** Aim the awakening (see AWAKEN_AT) from the lens as placed: the followed
   *  head at its place on the screen - carried from a shot this one started
   *  over - into `look`, the lens widened to hold the crown and the body.
   *  Returns the lens. */
  private frameHead(subject:Fighter,aspect:number,gameEye:THREE.Vector3,gameLook:THREE.Vector3,gameFov:number,lens:number,w:number){
    const head=this.awakenHead,s=this.screen,tanG=Math.tan(THREE.MathUtils.degToRad(gameFov)/2);
    // Where the gameplay shot has it; a head it cannot see (behind the lens, far
    // off the frame) has the look itself blended instead, below.
    const seen=screenOf(head,gameEye,gameLook,tanG,tanG*aspect,s)&&Math.abs(s.x)<2.5&&Math.abs(s.y)<2.5;
    const atX=this.closeUp?CLOSE_SHOT.atX:AWAKEN_AT_X;
    const at=(this.closeUp?CLOSE_SHOT.atY:AWAKEN_AT_Y)-AWAKEN_TALL*Math.min(1,this.awakenExcess/AWAKEN_TALL_AT);
    let x=seen?s.x+(atX-s.x)*w:atX,y=seen?s.y+(at-s.y)*w:at;
    if(this.awakenBridge){
      this.awakenBridge=false;this.awakenCarryX=this.awakenCarryY=0;
      const tanS=Math.tan(THREE.MathUtils.degToRad(this.shownFov)/2);
      if(screenOf(head,this.shownEye,this.shownLook,tanS,tanS*aspect,s)&&Math.abs(s.x)<2.5&&Math.abs(s.y)<2.5){this.awakenCarryX=s.x-x;this.awakenCarryY=s.y-y;}
    }
    if(this.carried<this.carryOver){const keep=1-ease(this.carried/this.carryOver);x+=this.awakenCarryX*keep;y+=this.awakenCarryY*keep;}
    let tanV=Math.tan(THREE.MathUtils.degToRad(lens)/2);
    aimAt(this.eye,head,x,y,tanV,tanV*aspect,this.look);
    // Widened for the crown and the body (see AWAKEN_TOP): a point's offset
    // from the pinned head scales with the inverse of the field. The limits
    // run from wherever the gameplay shot has them to the shot's own as it
    // takes the frame, so the widening needs no fading in to hand over cleanly.
    const p=subject.group.position;this.awakenBody.set(p.x,p.y+(this.closeUp?CLOSE_SHOT.hold:1),p.z);
    let top=AWAKEN_TOP,floorGame=Infinity;
    if(screenOf(this.awakenCrown,gameEye,gameLook,tanG,tanG*aspect,s))top=Math.max(AWAKEN_TOP,THREE.MathUtils.lerp(s.y,AWAKEN_TOP,w));
    if(screenOf(this.awakenBody,gameEye,gameLook,tanG,tanG*aspect,s))floorGame=s.y;
    let grow=1;
    if(y<top-.02&&screenOf(this.awakenCrown,this.eye,this.look,tanV,tanV*aspect,s)&&s.y>top)grow=(s.y-y)/(top-y);
    if(screenOf(this.awakenBody,this.eye,this.look,tanV,tanV*aspect,s)){
      let floor=this.closeUp?CLOSE_SHOT.floor:THREE.MathUtils.lerp(AWAKEN_FLOOR,AWAKEN_CARDS,THREE.MathUtils.smoothstep(s.x,AWAKEN_FINE_LINE[0],AWAKEN_FINE_LINE[1]));
      if(Number.isFinite(floorGame))floor=Math.min(floor,THREE.MathUtils.lerp(floorGame,floor,w));
      if(y>floor+.02&&s.y<floor)grow=Math.max(grow,(y-s.y)/(y-floor));
    }
    // It moves no faster than AWAKEN_WIDEN_RATE - a spirit rising or a pose
    // throwing the body about is a quick widening, not a cut - and is let go of as
    // the shot hands the frame back, so the gameplay shot is met exactly.
    const wide=grow>1?THREE.MathUtils.radToDeg(2*Math.atan(Math.min(tanV*grow,Math.tan(THREE.MathUtils.degToRad(AWAKEN_FOV_MOST)/2)))):lens;
    const move=AWAKEN_WIDEN_RATE*Math.min(this.frameDt,.1);
    this.awakenWide=THREE.MathUtils.clamp(Math.max(0,wide-lens),this.awakenWide-move,this.awakenWide+move);
    const widen=this.awakenWide*THREE.MathUtils.smoothstep(w,0,.25);
    if(widen>1e-6){lens+=widen;tanV=Math.tan(THREE.MathUtils.degToRad(lens)/2);aimAt(this.eye,head,x,y,tanV,tanV*aspect,this.look);}
    if(!seen)this.look.lerpVectors(gameLook,this.look,w);
    const f=this.awakenFrame;f.x=x;f.y=y;f.head.copy(head);f.clock=this.awakenClock;f.form=this.awakenForm;f.widen=widen;
    return lens;
  }
  /** Which way the body is actually facing. A clip can turn the torso well
   *  away from the fighter's gameplay facing - measured, Taisei's LAST SUN
   *  shows the lens his back from a shot placed 60 degrees off `rotation.y` -
   *  so the front is taken from the pose: up x (right - left), over the hips
   *  and the shoulders. A body with no rig (or no such joints) has only its
   *  gameplay facing. */
  private bodyFacing(subject:Fighter){
    const joints=subject.joints;let x=0,z=0;
    if(joints)for(const [l,r] of [['LeftUpLeg','RightUpLeg'],['LeftArm','RightArm']] as const){
      const a=joints.get(l),b=joints.get(r);if(!a||!b)continue;
      a.getWorldPosition(this.left);b.getWorldPosition(this.right);
      x+=this.right.z-this.left.z;z+=this.left.x-this.right.x;
    }
    return x*x+z*z>1e-6?Math.atan2(x,z):subject.group.rotation.y;
  }
  /** Clear distance from the pivot (or `from`) at azimuth `az`, out to `want`. */
  private clear(az:number,want:number,occluders:readonly THREE.Object3D[],from:THREE.Vector3=this.pivot){
    if(!occluders.length)return want;
    this.scratch.set(Math.sin(az),0,Math.cos(az));
    this.ray.set(from,this.scratch);this.ray.far=want+CLEARANCE;
    this.hits.length=0;this.ray.intersectObjects(occluders as THREE.Object3D[],true,this.hits);
    return this.hits.length?Math.max(0,this.hits[0].distance-CLEARANCE):want;
  }
  /** How near the victim the KO push may come along the line out to the
   *  gameplay lens (gx, gz, r metres long): `reach`, or no nearer than the far
   *  side of the clearance round anybody alive standing on that line. */
  private pastBodies(victim:Fighter,gx:number,gz:number,r:number,reach:number){
    if(!this.crowd||r<1e-3)return reach;
    this.lineX=gx/r;this.lineZ=gz/r;this.lineR=r;this.lineReach=reach;this.lineVictim=victim;
    this.crowd.forEach(this.onLine);this.lineVictim=undefined;
    return this.lineReach;
  }
  private onLine=(body:Fighter)=>{
    if(body===this.lineVictim||!body.state.alive||!body.group.visible)return;
    const p=this.pivot,q=body.group.position,bx=q.x-p.x,bz=q.z-p.z,along=bx*this.lineX+bz*this.lineZ;
    if(along<=0)return;
    const off=Math.abs(bx*this.lineZ-bz*this.lineX),inner=BODY_RADIUS*bodyBulk(body.state)+KO_CLEAR,outer=inner+KO_FADE;
    if(off>=outer)return;
    // Stopped where the line leaves the clearance round them; a body only
    // grazing the line stops it less, down to nothing at the fade's edge, so
    // somebody stepping onto the line is a slowing push, not a jump.
    const stop=Math.min(this.lineR,along+Math.sqrt(Math.max(0,inner*inner-off*off))),weight=1-THREE.MathUtils.smoothstep(off,inner,outer);
    this.lineReach=Math.max(this.lineReach,THREE.MathUtils.lerp(this.lineReach,stop,weight));
  };
  /** Lift `pushed` over every body it comes near (see LIFT_FADE): within
   *  LENS_CLEAR of the body's side it is over its head with LENS_CLEAR to
   *  spare, and the lift fades out smoothly LIFT_FADE further off. */
  private keepOut=(body:Fighter)=>{
    if(!body.group.visible)return;
    const p=body.group.position,alive=body.state.alive,bulk=drawnBulk(body),e=this.pushed;
    const radius=(alive?BODY_RADIUS*bulk:CORPSE_RADIUS)+LENS_CLEAR,top=(alive?p.y+BODY_HEIGHT*bulk:p.y+.3+CORPSE_RADIUS)+LENS_CLEAR;
    if(e.y>=top)return;
    const d=Math.hypot(e.x-p.x,e.z-p.z);if(d>=radius+LIFT_FADE)return;
    e.y+=(top-e.y)*(1-THREE.MathUtils.smoothstep(d,radius,radius+LIFT_FADE));
  };

  /** Round 3b: the summons the local player's ultimate has out `age` seconds
   *  into the cast, into `summons` (see GUARDIAN_BACK). */
  private summonsFor(caster:Fighter|undefined,age:number){
    this.summonCount=0;this.summoner=caster;
    if(!caster)return;
    const s=caster.state;
    if(s.action!=='ultimate'||!s.alive)return;
    const p=caster.group.position,fx=Math.sin(s.yaw),fz=Math.cos(s.yaw);
    if(s.awakened){
      // Kurobi: the fox's body, carried behind Konta's root (formForward),
      // as two lengths of it; its tails beyond fade near the lens on their own.
      if(s.fighter==='konta')for(const back of FOX_BODY){const v=this.nextSummon();v.x=p.x-fx*back;v.z=p.z-fz*back;v.y0=p.y+FOX_RADIUS;v.y1=p.y+FOX_TOP-FOX_RADIUS;v.radius=FOX_RADIUS;}
      if(s.fighter==='gummy')this.grandTideFist(s,age,p);
      return;
    }
    if(s.fighter==='shiden'&&age<GUARDIAN_FOR){
      const v=this.nextSummon();v.x=p.x-fx*GUARDIAN_BACK;v.z=p.z-fz*GUARDIAN_BACK;v.y0=p.y+GUARDIAN_RADIUS;v.y1=p.y+GUARDIAN_HEIGHT-GUARDIAN_RADIUS;v.radius=GUARDIAN_RADIUS;
    }else if(s.fighter==='kosho'){
      const v=this.nextSummon();v.x=p.x;v.z=p.z;v.y0=p.y+HELL_RADIUS;v.y1=p.y+HELL_HEIGHT-HELL_RADIUS;v.radius=HELL_RADIUS;
    }else if(s.fighter==='gummy')this.grandTideFist(s,age,p);
  }
  /** Round 4b (GUMMY): the GRAND TIDE's fist over the held victim, knuckles down and its bulk toward the caster
   *  (at `from`), until it is driven down through them. */
  private grandTideFist(s:{confirmedAt?:number},age:number,from:THREE.Vector3){
    const t=this.releaseVictim?.state.alive?this.releaseVictim.group.position:undefined;
    if(LUCY_TIDE){
      const column=tideColumn(age);if(s.confirmedAt===undefined||!t||!column)return;
      let ax=t.x-from.x,az=t.z-from.z;const l=Math.hypot(ax,az)||1;ax/=l;az/=l;
      const arms=this.nextSummon();arms.radius=.8;arms.x=from.x;arms.z=from.z;arms.y0=from.y+1.3;arms.y1=from.y+Math.max(1.4,column.height-.6);
      const wave=this.nextSummon();wave.radius=1.3;wave.x=t.x+ax*column.back;wave.z=t.z+az*column.back;wave.y0=t.y+1.4;wave.y1=t.y+column.height;
      return;
    }
    if(s.confirmedAt===undefined||!t||age<GRAND_TIDE_FROM||age>=GRAND_TIDE_AT)return;
    const size=GRAND_TIDE_SMALL+(GRAND_TIDE_BIG-GRAND_TIDE_SMALL)*THREE.MathUtils.smoothstep(age,GRAND_TIDE_FROM,GRAND_TIDE_DRIVE-.05);
    let ax=from.x-t.x,az=from.z-t.z;const l=Math.hypot(ax,az)||1;ax/=l;az/=l;
    const v=this.nextSummon();v.radius=size*GRAND_TIDE_BODY;v.x=t.x+ax*v.radius*.6;v.z=t.z+az*v.radius*.6;
    v.y0=t.y+1.9+GRAND_TIDE_OVER+v.radius;v.y1=v.y0+size*GRAND_TIDE_TALL;
  }
  private nextSummon(){return this.summons[Math.min(this.summonCount++,this.summons.length-1)];}
  /** Round 3c: sample the caster as drawn (see CASTER_POINTS), at most every
   *  CASTER_EVERY seconds: every visible surface it draws with depth - its
   *  body, a coat, a cape, a form it shows, a blade - evenly over all their
   *  vertices, skinned as posed, into world space. A ghost (drawn without
   *  depth) and the ink are left out. Allocation-free: two walks with a bound
   *  callback. */
  private sampleAwakenBlockers(subject:Fighter){
    this.awakenBlockerCount=0;
    const take=(body:Fighter)=>{
      if(body===subject||!body.state.alive||this.awakenBlockerCount>=this.awakenBlockers.length||body.group.position.distanceToSquared(subject.group.position)>225)return;
      const box=this.awakenBlockers[this.awakenBlockerCount];box.makeEmpty();
      body.group.updateWorldMatrix(true,true);
      let total=0,seen=0,taken=0;
      body.group.traverseVisible(o=>{const m=this.drawable(o);if(m)total+=m.geometry.getAttribute('position').count;});
      const stride=Math.max(1,Math.ceil(total/128));
      body.group.traverseVisible(o=>{
        const m=this.drawable(o);if(!m)return;
        const count=m.geometry.getAttribute('position').count;
        for(let i=(stride-seen%stride)%stride;i<count&&taken<128;i+=stride){m.getVertexPosition(i,this.awakenProbe);m.localToWorld(this.awakenProbe);box.expandByPoint(this.awakenProbe);taken++;}
        seen+=count;
      });
      if(box.isEmpty()){
        const p=body.group.position,b=drawnBulk(body);
        box.min.set(p.x-BODY_RADIUS*b,p.y,p.z-BODY_RADIUS*b);box.max.set(p.x+BODY_RADIUS*b,p.y+BODY_HEIGHT*b,p.z+BODY_RADIUS*b);
      }
      // A floor-plan envelope keeps both the chest and face clear throughout
      // the entry's height/push beat, including the final head-framing pass.
      box.expandByScalar(.18);box.min.y=-Infinity;box.max.y=Infinity;
      this.awakenBlockerCount++;
    };
    if(this.opponent)take(this.opponent);
    if(this.crowd)this.crowd.forEach(body=>{if(body!==this.opponent)take(body);});
  }
  private awakenBodyClear(az:number,reach:number){
    this.awakenProbe.set(Math.sin(az),0,Math.cos(az));
    this.ray.ray.set(this.pivot,this.awakenProbe);
    for(let i=0;i<this.awakenBlockerCount;i++){
      const hit=this.ray.ray.intersectBox(this.awakenBlockers[i],this.awakenHit);
      if(hit&&hit.distanceToSquared(this.pivot)<reach*reach)return false;
    }
    return true;
  }
  private sampleCaster(caster:Fighter){
    if(caster===this.drawnOf&&this.sinceReset-this.drawnClock<CASTER_EVERY)return;
    this.drawnOf=caster;this.drawnClock=this.sinceReset;
    caster.group.updateWorldMatrix(true,true);
    this.drawnTotal=0;this.drawnSeen=0;this.drawnCount=0;
    caster.group.traverseVisible(this.countDrawn);
    this.drawnStride=Math.max(1,Math.ceil(this.drawnTotal/CASTER_POINTS));
    caster.group.traverseVisible(this.takeDrawn);
  }
  private drawable(object:THREE.Object3D){
    const mesh=object as THREE.Mesh;
    if(!mesh.isMesh||!mesh.geometry?.getAttribute('position')||/-ink$|occlusion-warm|contact-shadow/.test(mesh.name))return undefined;
    const material=Array.isArray(mesh.material)?mesh.material[0]:mesh.material;
    // Only what hides what is behind it: not a translucent shell (Ward's ROOM,
    // the Guardian's glass), a ghost drawn without depth, or the ink.
    if(!material||material.visible===false||material.userData?.ink||material.depthWrite===false||(material.transparent&&material.opacity<.6))return undefined;
    return mesh;
  }
  private countDrawn=(object:THREE.Object3D)=>{const mesh=this.drawable(object);if(mesh)this.drawnTotal+=mesh.geometry.getAttribute('position').count;};
  private takeDrawn=(object:THREE.Object3D)=>{
    const mesh=this.drawable(object);if(!mesh)return;
    const count=mesh.geometry.getAttribute('position').count,v=this.clothProbe;
    // The stride runs on across meshes, so every one is sampled evenly.
    for(let i=(this.drawnStride-this.drawnSeen%this.drawnStride)%this.drawnStride;i<count&&this.drawnCount<CASTER_POINTS;i+=this.drawnStride){
      mesh.getVertexPosition(i,v);mesh.localToWorld(v);
      const k=this.drawnCount++*3;this.drawn[k]=v.x;this.drawn[k+1]=v.y;this.drawn[k+2]=v.z;
    }
    this.drawnSeen+=count;
  };
  /** How near the caster as drawn comes to the point `e`. */
  private casterGap(e:THREE.Vector3){
    let least=Infinity;
    for(let i=0;i<this.drawnCount;i++){const k=i*3,dx=this.drawn[k]-e.x,dy=this.drawn[k+1]-e.y,dz=this.drawn[k+2]-e.z;least=Math.min(least,dx*dx+dy*dy+dz*dz);}
    return Math.sqrt(least);
  }
  /** Whether the caster as drawn stands on the sight line a->b (see
   *  CASTER_HIDES): its points near the line's far end - the victim's own
   *  side of an embrace - count as much as any. */
  private casterHides(a:THREE.Vector3,b:THREE.Vector3){
    const lx=b.x-a.x,ly=b.y-a.y,lz=b.z-a.z,ll=lx*lx+ly*ly+lz*lz;
    if(!(ll>1e-8))return false;
    let near=0;const r2=CASTER_SIGHT*CASTER_SIGHT;
    for(let i=0;i<this.drawnCount;i++){
      const k=i*3,px=this.drawn[k]-a.x,py=this.drawn[k+1]-a.y,pz=this.drawn[k+2]-a.z,u=(px*lx+py*ly+pz*lz)/ll;
      if(u<=0||u>=1)continue;
      const qx=px-lx*u,qy=py-ly*u,qz=pz-lz*u;
      if(qx*qx+qy*qy+qz*qz<r2&&++near>CASTER_HIDES)return true;
    }
    return false;
  }
  /** Whether a lens at `eye` is inside a summon or within SUMMON_CLEAR of it. */
  private inSummon(eye:THREE.Vector3,clear=SUMMON_CLEAR){
    for(let i=0;i<this.summonCount;i++){
      const v=this.summons[i],reach=v.radius+clear,below=eye.y<v.y0?v.y0-eye.y:eye.y>v.y1?eye.y-v.y1:0;
      if(Math.hypot(eye.x-v.x,eye.z-v.z,below)<reach)return true;
    }
    return false;
  }
  /** Whether a summon stands on the sight line sightFrom -> sightTo. The
   *  caster's own sight lines are taken through his summons. */
  private summonBlocks(){
    if(this.sightSubject===this.summoner)return false;
    for(let i=0;i<this.summonCount;i++){
      const v=this.summons[i];
      if(sightClearance(this.sightFrom,this.sightTo,v.x,v.z,v.y0,v.y1,v.radius)<v.radius)return true;
    }
    return false;
  }
  /** The most of the frame - as a share of its area - that any body but `a`
   *  and `b` fills, for a lens at `eye` looking at `look` with a field of
   *  `fov` degrees (see CROWD_MOST). A body the lens stands in fills half of
   *  it. Walked with a bound callback over scratch fields. */
  /** Round 3d (ULTS): how far `eye` stands, across the floor, from the
   *  nearest body on its feet other than `a` and `b` (see BYSTANDER_CLEAR).
   *  Walked with a bound callback over scratch fields. */
  private bystanderGap(eye:THREE.Vector3,a?:Fighter,b?:Fighter){
    this.gapEye.copy(eye);this.gapA=a;this.gapB=b;this.gapNear=Infinity;
    this.crowd?.forEach(this.gapOne);
    return this.gapNear;
  }
  private gapEye=new THREE.Vector3();private gapA?:Fighter;private gapB?:Fighter;private gapNear=Infinity;
  private gapOne=(body:Fighter)=>{
    if(body===this.gapA||body===this.gapB||!body.state.alive)return;
    const p=body.group.position;this.gapNear=Math.min(this.gapNear,Math.hypot(p.x-this.gapEye.x,p.z-this.gapEye.z));
  };
  private crowdCover(eye:THREE.Vector3,look:THREE.Vector3,fov:number,a?:Fighter,b?:Fighter){
    if(!this.crowd)return 0;
    this.viewEye.copy(eye);this.viewForward.subVectors(look,eye);
    if(this.viewForward.lengthSq()<1e-8)return 0;
    this.viewForward.normalize();this.viewRight.crossVectors(this.viewForward,WORLD_UP);
    if(this.viewRight.lengthSq()<1e-8)return 0;
    this.viewRight.normalize();this.viewUp.crossVectors(this.viewRight,this.viewForward);
    this.crowdTanV=Math.tan(THREE.MathUtils.degToRad(fov)/2);this.crowdTanH=this.crowdTanV*this.aspect;
    this.crowdA=a;this.crowdB=b;this.crowdWorst=0;
    this.crowd.forEach(this.crowdOne);
    this.crowdA=this.crowdB=undefined;
    return this.crowdWorst;
  }
  private crowdOne=(body:Fighter)=>{
    if(body===this.crowdA||body===this.crowdB||!body.state.alive||!body.group.visible)return;
    const p=body.group.position,bulk=drawnBulk(body),radius=BODY_RADIUS*bulk,f=this.viewForward,r=this.viewRight,u=this.viewUp;
    let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity,front=0;
    for(let k=0;k<2;k++){
      const dx=p.x-this.viewEye.x,dy=p.y+(k?BODY_HEIGHT*bulk:0)-this.viewEye.y,dz=p.z-this.viewEye.z,z=dx*f.x+dy*f.y+dz*f.z;
      if(z<.15)continue;
      front++;
      const x=(dx*r.x+dy*r.y+dz*r.z)/(z*this.crowdTanH),y=(dx*u.x+dy*u.y+dz*u.z)/(z*this.crowdTanV),px=radius/(z*this.crowdTanH),py=radius/(z*this.crowdTanV);
      x0=Math.min(x0,x-px);x1=Math.max(x1,x+px);y0=Math.min(y0,y-py);y1=Math.max(y1,y+py);
    }
    // One end in front of the lens and one behind: the lens is in them.
    if(front===1&&Math.hypot(p.x-this.viewEye.x,p.z-this.viewEye.z)<radius+LENS_CLEAR){this.crowdWorst=Math.max(this.crowdWorst,.5);return;}
    if(!front)return;
    const w=Math.min(x1,1)-Math.max(x0,-1),h=Math.min(y1,1)-Math.max(y0,-1);
    if(w>0&&h>0)this.crowdWorst=Math.max(this.crowdWorst,w*h/4);
  };
  /** How crowded the close-up framing `framing` on side `side` is (see
   *  CROWD_MOST): the most of its frame anybody but the caster fills, over
   *  its push-in; everything, with the lens in a summon. */
  private heroCrowd(subject:Fighter,framing:number,side:number,bulk:number){
    let worst=0;
    for(let k=0;k<2;k++){
      this.heroPose(subject,k?this.length:HERO_IN*.5,framing,this.facing+side*HERO_FRAMINGS[framing].angle,bulk);
      if(this.inSummon(this.eye))return 1;
      worst=Math.max(worst,this.crowdCover(this.eye,this.look,this.fov,subject));
    }
    return worst;
  }
  /** Whether the release shot on side `side`, `turn` off the line back from
   *  the victim (bearing `bearing` from the caster), works: the lens out of
   *  the summons, the victim and the caster both seen past everybody else,
   *  no bystander filling the frame, and the room behind it clear of walls.
   *  Returns 0 when it does, and otherwise how badly it fails. */
  private releaseMiss(caster:Fighter,bulk:number,bearing:number,side:number,turn:number,victim:Fighter|undefined,wantRoom:number){
    const p=caster.group.position,az=bearing+side*(Math.PI-turn);
    let r=RELEASE_R*bulk;
    this.probeEye.set(p.x+Math.sin(az)*r,p.y+(1.1+RELEASE_EYE)*bulk,p.z+Math.cos(az)*r);
    while(this.inSummon(this.probeEye,SUMMON_STAND)&&r<RELEASE_REACH*bulk){r+=SUMMON_STEP;this.probeEye.set(p.x+Math.sin(az)*r,this.probeEye.y,p.z+Math.cos(az)*r);}
    this.probeReach=r;
    if(this.inSummon(this.probeEye))return 10;
    let miss=0;
    if(victim){
      const v=victim.group.position,vb=bodyBulk(victim.state);
      if(!this.sees(this.probeEye,victim,vb,0))miss+=4;
      this.probeLook.set(v.x,v.y+1.1*vb,v.z);
      // Across the frame from the caster, not looming at the lens.
      const room=Math.hypot(this.probeEye.x-v.x,this.probeEye.z-v.z);
      if(room<RELEASE_ROOM*vb)miss+=1+(RELEASE_ROOM*vb-room);
    }else this.probeLook.set(p.x+Math.sin(bearing)*RELEASE_AHEAD,p.y+1.1*bulk,p.z+Math.cos(bearing)*RELEASE_AHEAD);
    if(!this.sees(this.probeEye,caster,bulk,0))miss+=2;
    // Round 3c: nor behind the caster's own coat or cape as drawn (see
    // CASTER_HIDES), from a lens clear of them.
    if(this.drawnCount&&caster===this.drawnOf){
      if(victim){
        const v=victim.group.position,vb=bodyBulk(victim.state);
        this.sightTo.set(v.x,v.y+1.1*vb,v.z);const chest=this.casterHides(this.probeEye,this.sightTo);
        this.sightTo.set(v.x,v.y+1.62*vb,v.z);if(chest||this.casterHides(this.probeEye,this.sightTo))miss+=3;
      }
    }
    const crowded=this.crowdCover(this.probeEye,this.probeLook,RELEASE_FOV,caster,victim);
    if(crowded>CROWD_MOST)miss+=1+crowded;
    const gap=this.bystanderGap(this.probeEye,caster,victim);
    if(gap<BYSTANDER_CLEAR)miss+=.5+BYSTANDER_CLEAR-gap;
    if(miss===0&&this.walls.length&&this.clear(az,wantRoom,this.walls)<wantRoom-1e-3)miss+=.5;
    return miss;
  }
  /** The shot's own pose into eye/look/fov, and its scripted weight. */
  private script(subject:Fighter,gameEye:THREE.Vector3,gameFov:number,bulk:number,step:number){
    // The front the shot is built on follows the body, eased, so a clip that
    // turns the fighter swings the shot round with them rather than jerking it.
    this.facing+=wrapped(this.bodyFacing(subject)-this.facing)*blend(6,step);
    const t=this.t,facing=this.facing;
    // The winner is the size of the winner, whoever the camera belongs to -
    // and the impact's victim theirs (round 3c: it took the caster's, so Full
    // Swell's giant fist, Kurobi's and a Guardian's impact stood 6 m off a normal body,
    // aimed 2 m over its root, and rose to the ceiling with it).
    const size=this.kind==='victory'||this.kind==='impact'?bodyBulk(subject.state):bulk;
    if(this.kind!=='awaken')this.setPivot(subject,size);
    else{const p=subject.group.position;this.pivot.set(p.x,p.y+1.2,p.z);}
    const at=(az:number,r:number,y:number)=>this.eye.set(this.pivot.x+Math.sin(az)*r,this.pivot.y+y,this.pivot.z+Math.cos(az)*r);
    const inOut=(inner:number,outer:number)=>Math.min(inner>0?ease(t/inner):1,1-ease((t-(this.length-outer))/outer));
    switch(this.kind){
      case 'ultimate':{
        // The victim is whoever the move is aimed at (round 3b): since TARGET's
        // pick an attack may go to somebody else than the lock-on had framed
        // when the cast began, and the shot followed the wrong fighter.
        const aimed=subject.state.target?this.crowd?.get(subject.state.target):undefined;
        if(aimed&&aimed!==subject&&aimed.state.alive&&aimed!==this.releaseVictim){this.releaseVictim=aimed;this.releaseSearched=-Infinity;}
        // What the move has summoned by now (round 3b, see GUARDIAN_BACK).
        this.summonsFor(subject,this.castAge+t);
        // Round 3d (ULTS): a hit-confirm cinematic is the release shot (or the
        // field) from its first frame, swung into from wherever the lens was.
        if(this.cine){
          if(this.tour)this.fieldPose(subject,bulk,step,gameEye);
          else{this.turnRelease(subject,bulk,step);this.releasePose(subject,bulk);}
          this.handBack=this.travel(INTERRUPT,gameEye);
          if(t<this.length-this.out){this.out=this.travel(HERO_OUT,gameEye);this.length=this.bUntil+this.out;}
          return inOut(this.into,this.out);
        }
        // A: the close-up, turning with the body while it is on screen.
        this.heroPose(subject,t,this.framing,this.heroAz,bulk);
        if(t<this.aEnd&&this.turnHero(subject,bulk,step,facing+this.side*HERO_FRAMINGS[this.framing].angle))this.heroPose(subject,t,this.framing,this.heroAz,bulk);
        if(t>this.aEnd){
          // B: the release shot, swung to from the close-up round the same
          // caster, the swing timed by its travel on its first frame.
          this.heroEye.copy(this.eye);this.heroLook.copy(this.look);this.heroFov=this.fov;
          // A time stop's field instead of the release (see FIELD_R).
          if(this.tour)this.fieldPose(subject,bulk,step,gameEye);
          else{
          if(this.toB<0){this.releaseAz=this.releaseBearing(subject,bulk);this.releaseTurn=0;}
          else this.turnRelease(subject,bulk,step);
          this.releasePose(subject,bulk);
          }
          if(this.toB<0){
            // Round 3b: round the side nobody stands on - the short way round
            // from a front three-quarter to over the other shoulder went
            // through the victim standing in front of the caster.
            const orbit=Math.abs(wrapped(Math.atan2(this.eye.x-this.pivot.x,this.eye.z-this.pivot.z)-Math.atan2(this.heroEye.x-this.pivot.x,this.heroEye.z-this.pivot.z)));
            const shortAir=this.swingClearance(false);
            this.swingLong=!this.tour&&shortAir<SWING_CLEAR&&Math.PI*2-orbit<=orbit*1.4+.6&&this.swingClearance(true)>shortAir+.2;
            const turn=Math.abs(wrapped(Math.atan2(this.look.x-this.eye.x,this.look.z-this.eye.z)-Math.atan2(this.heroLook.x-this.heroEye.x,this.heroLook.z-this.heroEye.z)));
            // A time stop's field is reached by the time the tour is under
            // way: its swing is timed by the aim alone, never longer than
            // TOUR_SWING - the lens climbs out as the stopped world is shown.
            this.toB=this.tour?Math.min(TOUR_SWING,Math.max(HERO_OUT,1.875*turn/AIM_SPEED)):Math.min(SWING_LONGEST,Math.max(this.travel(HERO_OUT,this.heroEye),1.875*turn/AIM_SPEED));
            // The long way round takes as much longer as it is longer.
            if(this.swingLong)this.toB=Math.min(SWING_LONGEST,this.toB*(Math.PI*2-orbit)/Math.max(orbit,.3));
          }
          const u=ease((t-this.aEnd)/this.toB);
          if(u<1)this.between(u);
        }
        // Until the hand-back has begun, it is timed by the way back from
        // wherever the lens is; so is a hand-back cut short, at any point.
        this.handBack=this.travel(INTERRUPT,gameEye);
        if(t<this.length-this.out){this.out=this.travel(HERO_OUT,gameEye);this.length=Math.max(this.bUntil,this.aEnd+Math.max(this.toB,HERO_OUT)+RELEASE_HOLD_LEAST)+this.out;}
        return inOut(this.into,this.out);
      }
      case 'impact':{
        // The caster's summons stand through it (round 3b).
        this.summonsFor(this.caster,this.caster?this.caster.state.actionTime*this.caster.state.actionDuration:0);
        // On the body as drawn, from a bearing clear of the wall it is being
        // thrown at, wide enough for all of it (see IMPACT_AHEAD).
        this.followDrawn(subject,step);this.turnImpact(subject,size,step);
        // Round 3c: under IMPACT_TOP, looking up at them no steeper than
        // IMPACT_UP - and held until they are down (see IMPACT_DOWN).
        // A victim high over the lens is looked at from further off, so they
        // stay under the HUD's bars (see IMPACT_ABOVE).
        const eyeY=this.impactEye(size),reach=Math.max(IMPACT_R*size,Math.max(0,-eyeY)/Math.tan(IMPACT_UP+IMPACT_ABOVE));
        at(this.impactAz,reach,eyeY);
        this.look.copy(this.pivot);this.look.y=Math.min(this.look.y,this.eye.y+reach*Math.tan(IMPACT_UP));this.fov=IMPACT_FOV;
        const vs=subject.state;if(!vs.grounded)this.impactFlew=true;
        if(this.impactDownAt<0&&(this.impactFlew?vs.grounded:this.t>=this.impactLead))this.impactDownAt=this.t;
        // The way back is timed by its travel, the victim being metres from
        // the player by now.
        this.handBack=this.travel(INTERRUPT,gameEye);
        if(t<this.length-this.out){this.out=this.travel(IMPACT_OUT,gameEye);this.length=this.impactHold()+this.out;}
        return inOut(this.impactIn,this.out);
      }
      case 'awaken':{
        // Round 3e (MODELS2): paced by the transformation's beat (awakenBeat.ts),
        // on the fighter's own entry clock - the one the swap and the burst run on.
        // Round 3f (CAM5): only ever forward, on at the shot's own pace while
        // the presented entry drops out (see AWAKEN_GRACE), and catching up
        // with a clock that leaps no faster than AWAKEN_CATCH times that.
        const st=subject.state,swap=awakeningSwapAt(st.fighter);
        this.awakenClock=st.action==='awaken'?THREE.MathUtils.clamp(st.actionTime*st.actionDuration,this.awakenClock,this.awakenClock+step*AWAKEN_CATCH):this.awakenClock+step;
        const beat=awakenBeat(this.awakenClock,swap);
        // The head as drawn, followed (see AWAKEN_AT); from the burst a form is
        // stood back from by its size, the lens rising with it.
        this.awakenForm=this.formShare(st);
        this.followHead(subject);
        // The silhouette's crown eased (it is sampled ten times a second); the
        // form's bulk as far as the shot has gone over to it, which is eased.
        this.awakenSize+=(this.crownSize(subject)-this.awakenSize)*blend(AWAKEN_SIZE_RATE,step);
        const size=this.awakenFrame.size=Math.min(AWAKEN_SIZE_MOST,Math.max(this.awakenSize,1+(bodyBulk(st)-1)*this.awakenForm));
        if(this.closeUp){
          // The Close close-up (CLOSE_SHOT): the beat's own gather, burst and settle, a slow orbit toward the
          // front and push in, from low down, on its own field rather than the gameplay lens's.
          const c=CLOSE_SHOT;
          at(this.startAz+this.side*c.orbit*beat.orbit/AWAKEN_ORBIT_SHARE,this.startR*(1-beat.push*c.push)*size,this.startY*(1-beat.drop*.5)+(size-1)*AWAKEN_SIZE_LIFT);
          this.look.copy(this.pivot).y+=.3;this.fov=c.fov-AWAKEN_FOV*beat.fov*c.zoom+beat.widen;
          return inOut(Math.max(c.in,this.awakenIn,1.875*AWAKEN_AIM*this.awakenSwing/AIM_SPEED),c.out);
        }
        at(this.startAz+this.side*AWAKEN_ORBIT*beat.orbit,this.startR*(1-beat.push)*size,this.startY*(1-beat.drop)+(size-1)*AWAKEN_SIZE_LIFT);
        this.look.copy(this.pivot).y+=.3;this.fov=gameFov-AWAKEN_FOV*beat.fov+beat.widen;
        // A swing to a clear bearing (round 3e) takes as long as the aim needs,
        // and the blend in as long as the head's way across the screen needs.
        return inOut(Math.max(Math.min(AWAKEN_IN,beat.in),this.awakenIn,1.875*AWAKEN_AIM*this.awakenSwing/AIM_SPEED),AWAKEN_OUT);
      }
      case 'opener':{
        // Round 3d (ULTS): the gameplay shot, dollied in along its own line
        // to the caster and a little narrower (see OPENER_PUSH); its framing
        // - the caster and whoever the opener is thrown at - is kept.
        const g=this.scratch.subVectors(gameEye,this.pivot),r=Math.hypot(g.x,g.z),gy=g.y;
        const want=r>OPENER_NEAREST?Math.max(OPENER_NEAREST,r*(1-OPENER_PUSH)):r,reach=this.pastBodies(subject,g.x,g.z,r,want);
        at(Math.atan2(g.x,g.z),reach,gy*(r>1e-3?reach/r:1));
        this.look.copy(this.gameLook);this.fov=gameFov-OPENER_FOV;
        return inOut(OPENER_IN,OPENER_OUT);
      }
      case 'ko':{
        const g=this.scratch.subVectors(gameEye,this.pivot),r=Math.hypot(g.x,g.z),gy=g.y;
        const reach=this.pastBodies(subject,g.x,g.z,r,Math.max(Math.min(KO_NEAREST,r),r*(1-KO_PUSH)));
        at(Math.atan2(g.x,g.z),reach,gy*.8);
        this.look.copy(this.pivot);this.fov=gameFov-KO_FOV;
        return inOut(KO_IN,KO_OUT);
      }
      case 'intro':{
        const u=t/this.length;
        at(facing+this.side*(INTRO_FRONT+.3*u),INTRO_RADIUS-.8*u,.15);
        this.look.copy(this.pivot).y+=.1;this.fov=INTRO_FOV;
        const leave=1-ease((u-(1-INTRO_LEAVE))/INTRO_LEAVE);
        return Math.min(this.opening?1:ease(t/INTRO_IN),leave);
      }
      case 'victory':{
        const u=t/this.length;
        at(facing+this.side*(VICTORY_ANGLE+this.victoryTurn+.6*u),VICTORY_RADIUS*size,VICTORY_EYE*size);
        this.look.copy(this.pivot).y+=.2;this.fov=VICTORY_FOV;
        return inOut(this.opening?0:VICTORY_IN,VICTORY_OUT);
      }
      default:return 0;
    }
  }

  /** Blend the gameplay shot toward the shot's pose round the pivot, keep it
   *  out of the walls and the bodies, and put it on the camera. */
  private present(dt:number,camera:THREE.PerspectiveCamera,subject:Fighter,gameEye:THREE.Vector3,gameLook:THREE.Vector3,gameFov:number,occluders:readonly THREE.Object3D[],w:number){
    const p=this.pivot,g=this.scratch.subVectors(gameEye,p);
    const azG=Math.atan2(g.x,g.z),rG=Math.hypot(g.x,g.z),yG=g.y;
    const azS=Math.atan2(this.eye.x-p.x,this.eye.z-p.z),rS=Math.hypot(this.eye.x-p.x,this.eye.z-p.z),yS=this.eye.y-p.y;
    let az=azG+wrapped(azS-azG)*w,r=THREE.MathUtils.lerp(rG,rS,w),y=THREE.MathUtils.lerp(yG,yS,w);
    this.look.lerpVectors(gameLook,this.look,w);
    let lens=THREE.MathUtils.lerp(gameFov,this.fov,w);
    if(this.bridge){
      // Start where the lens really was: the difference from this new shot's
      // first pose is carried, round the new pivot, and shed over CARRY.
      this.bridge=false;this.carried=0;this.carryOver=this.kind==='impact'?this.impactCarry:CARRY;
      this.carryAz=wrapped(Math.atan2(this.shownEye.x-p.x,this.shownEye.z-p.z)-az);
      this.carryR=Math.hypot(this.shownEye.x-p.x,this.shownEye.z-p.z)-r;this.carryY=this.shownEye.y-p.y-y;
      this.carryLook.subVectors(this.shownLook,this.look);this.carryFov=this.shownFov-lens;
      // Round 3f (CAM5): the awakening carries where the head was on the screen.
      this.awakenBridge=this.kind==='awaken';
    }else this.carried=Math.min(this.carryOver,this.carried+dt);
    if(this.carried<this.carryOver){
      const keep=1-ease(this.carried/this.carryOver);
      az+=this.carryAz*keep;r+=this.carryR*keep;y+=this.carryY*keep;this.look.addScaledVector(this.carryLook,keep);lens+=this.carryFov*keep;
    }
    this.eye.set(p.x+Math.sin(az)*r,p.y+y,p.z+Math.cos(az)*r);
    // Round 3c: out of the caster's coat, cape or form (see CASTER_CLEAR):
    // across the floor, away from their root, as far as it takes - worked out
    // from the shot as posed, so the push never feeds on itself - eased.
    this.clothGoal.set(0,0,0);
    if(this.drawnCount&&this.caster){
      const c=this.caster.group.position,e=this.clothProbe.copy(this.eye);
      let dx=e.x-c.x,dz=e.z-c.z;const l=Math.hypot(dx,dz);
      if(l>1e-3){dx/=l;dz/=l;}else{dx=Math.sin(az);dz=Math.cos(az);}
      for(let k=0;k<5;k++){const gap=this.casterGap(e);if(gap>=CASTER_CLEAR)break;const out=CASTER_CLEAR-gap+.02;e.x+=dx*out;e.z+=dz*out;}
      this.clothGoal.subVectors(e,this.eye);
      if(this.clothGoal.lengthSq()>CASTER_PUSH_MOST*CASTER_PUSH_MOST)this.clothGoal.setLength(CASTER_PUSH_MOST);
    }
    this.clothPush.lerp(this.clothGoal,blend(this.clothGoal.lengthSq()>this.clothPush.lengthSq()?CASTER_IN:CASTER_OUT,dt));
    if(this.clothGoal.lengthSq()===0&&this.clothPush.lengthSq()<1e-8)this.clothPush.set(0,0,0);
    this.eye.addScaledVector(this.clothPush,w);
    // Out of the walls: in at once when something is in the way, back out
    // slowly, and only as much as the shot owns the frame - the gameplay shot
    // it blends from keeps its own scenery cutaway.
    // Round 3e: an awakening that began behind a wall leaves it to the stage
    // fade (see AWAKEN_STEP).
    if(this.kind==='awaken'&&this.awakenFree)this.pull=0;
    else if(occluders.length){
      const back=this.scratch.subVectors(gameEye,p),gameReach=back.length();
      if(gameReach>1e-3){
        this.ray.set(p,back.divideScalar(gameReach));this.ray.far=gameReach;
        this.hits.length=0;this.ray.intersectObjects(occluders as THREE.Object3D[],true,this.hits);
        // Measured, not assumed, on a shot's first frame: starting from
        // "clear" snapped a lens that began behind a wall 3 m onto it.
        const clear=this.hits.length?0:1;
        this.firm=this.firm<0?clear:this.firm+(clear-this.firm)*blend(6,dt);
      }else if(this.firm<0)this.firm=1;
      const span=this.scratch.subVectors(this.eye,p),length=span.length();
      if(length>1e-3){
        this.ray.set(p,span.divideScalar(length));this.ray.far=length+CLEARANCE;
        this.hits.length=0;this.ray.intersectObjects(occluders as THREE.Object3D[],true,this.hits);
        // In at once, back out gently: a lens grazing a pillar's edge does
        // not strobe. It is the pull-in that is smoothed, not the reach, so a
        // shot swinging to a clear side lets go instead of dragging a stale
        // distance along with it.
        const allowed=this.hits.length?Math.max(MIN_REACH,this.hits[0].distance-CLEARANCE):length,want=Math.max(0,length-allowed);
        this.pull=want>this.pull?(this.kind==='impact'?this.pull+(want-this.pull)*blend(IMPACT_PULL,dt):want):this.pull+(want-this.pull)*blend(8,dt);
        const kept=Math.max(Math.min(MIN_REACH,length),length-Math.max(w,this.firm)*this.pull);
        this.eye.copy(p).addScaledVector(span,kept);
      }
    }
    // Out of the bodies: whatever the shot's path, the lens never films from
    // inside a fighter - pushed straight out of any capsule it enters, which
    // is continuous in where the lens is, and only as far as the shot owns
    // the frame, so the hand-back lands exactly on the gameplay lens.
    if(this.crowd){this.pushed.copy(this.eye);this.crowd.forEach(this.keepOut);this.eye.lerp(this.pushed,w);}
    // Nor from inside what the move summons (round 3b): pushed out across the
    // floor to SUMMON_CLEAR off it, as far as the shot owns the frame.
    for(let i=0;i<this.summonCount;i++){
      const v=this.summons[i],dx=this.eye.x-v.x,dz=this.eye.z-v.z,flat=Math.hypot(dx,dz),reach=v.radius+SUMMON_CLEAR;
      if(flat>=reach||this.eye.y>v.y1+reach||this.eye.y<v.y0-reach)continue;
      const out=(reach-flat)*w;
      if(flat>1e-4){this.eye.x+=dx/flat*out;this.eye.z+=dz/flat*out;}
    }
    this.eye.y=Math.max(this.eye.y,(this.kind==='impact'?this.impactFloor:subject.group.position.y)+.25);
    // Round 3f (CAM5): the awakening is aimed at the head from wherever the
    // lens has ended up (see AWAKEN_AT).
    if(this.kind==='awaken')lens=this.frameHead(subject,camera.aspect,gameEye,gameLook,gameFov,lens,w);
    // The impact shot holds all of the victim from wherever the lens ended up
    // (see IMPACT_FILL), and fits the next frame to it as well.
    if(this.kind==='impact'){this.impactFit=this.fieldFor(subject,this.eye,this.look);lens=Math.max(lens,THREE.MathUtils.lerp(gameFov,this.impactFit,w));}
    // The winner held whole from the waist up wherever the lens ended up (VICTORY_FIT).
    if(this.kind==='victory'){this.victoryFit+=(this.victoryField(subject,this.eye,this.look)-this.victoryFit)*blend(4,dt);lens=Math.max(lens,THREE.MathUtils.lerp(gameFov,this.victoryFit,w));}else this.victoryFit=VICTORY_FOV;
    camera.position.copy(this.eye);camera.lookAt(this.look);camera.fov=lens;
    this.shownEye.copy(this.eye);this.shownLook.copy(this.look);this.shownFov=lens;
    // Round 3c: the caster as drawn over the victim - their hips, chest or
    // head - for the fade, held HIDDEN_HOLD after the last frame it was so: a
    // cape sampled ten times a second across a line flickers, and the fade
    // lets the caster's window go fast.
    const victim=this.shotVictim;let hidden=false;
    if(victim&&this.drawnCount&&victim!==this.caster){
      const v=victim.group.position,vb=bodyBulk(victim.state);
      for(const up of HIDDEN_LINES){this.sightTo.set(v.x,v.y+up*vb,v.z);if(this.casterHides(this.eye,this.sightTo)){hidden=true;break;}}
    }
    this.hiddenHold=hidden?HIDDEN_HOLD:victim?Math.max(0,this.hiddenHold-dt):0;
    this.victimBehindCaster=this.hiddenHold>0;
  }
}
