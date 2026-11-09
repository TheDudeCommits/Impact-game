import { isReleasedFighter } from './rosterAvailability';
import { tidyName } from './displayName';
import { TrainingLab } from './training/TrainingLab';
import { AREA_DEFAULTS, BURN_TICK, FREEZE_IMMUNITY } from './moves';
import { activeWindow, ADV_ON_HIT, PUSH_RADIUS, AIR_CAST_GRAVITY, PLUNGE_HANG, PLUNGE_LIMIT, AIR_DASH_SPEED, DASH_SECONDS, DASH_RISE, DASH_FALL, dashShape, AIR_NORMALS, ARENA_COLLIDERS, BREAK_EVADE, BREAK_FREEZE, BREAK_PUSH, CONTACT_GAP, contactGap, MAX_APPROACH, MAX_CLOSE, MAX_FLOOR_STUN, meleeReach, LAUNCH_GRAVITY, LAUNCH_LEAD, launchLead, STRING_SHOVE, STRING_DRAG, COMBO_WINDOW, GETUP_SECONDS, GUARD_BREAK_STUN,
  HITSTOP, INPUT_BUFFER, JUGGLE_DECAY, JUGGLE_LIFT, KNOCKDOWN_SECONDS, LAUNCH_KNOCKBACK, MAX_HP, MAX_JUGGLE,
  BREAK_CASTS, damageScale,
  MAX_PLAYERS, MOVES, PLAYER_RADIUS, TECH_DELAY, TECH_STAMINA,
  CHIP, GROUND_BOUNCE_LIFT, JUST_GUARD_ADVANTAGE, JUST_GUARD_METER, JUST_GUARD_WINDOW,
  AIR_CONTROL, BLOCK_PUSH, BLOCK_STUN, GROUND_ACCEL, GROUND_BRAKE, GROUND_TURN_ACCEL,
  WALL_SPLAT_SPEED, WALL_SPLAT_STUN,
  FALL_GRAVITY, JUMP_CUT_GRAVITY, JUMP_CUT_AFTER, ULTIMATE_COST, ULTIMATE_PER_DAMAGE, AWAKENING_PER_DAMAGE, AWAKENING_PER_BLOCKED,
  DASH_EVADE, BACKDASH_SECONDS, BACKDASH_TRAVEL, BACKDASH_EVADE, BACKDASH_ALONG,
  SIDESTEP_SECONDS, SIDESTEP_TRAVEL, SIDESTEP_ALONG, dashPeakSpeed,
  airRushName, AIR_RUSH, RUSH_AIR_STAGES, RUSH_STAGES, RUSH_WINDOW,
  VANISH_AIM, VANISH_BEHIND, VANISH_COOLDOWN, VANISH_EVADE, VANISH_ON_JUST_GUARD, VANISH_STUMBLE,
  CHASE_EXIT, CHASE_MAX_SPEED, CHASE_RANGE, CHASE_SECONDS, CHASE_WINDOW, LIGHT_CHASE_WINDOW, LAUNCH_HOLD_RANGE,
  CHARGE_BACKSTEP_UNTIL, DASH_THROUGH_LEAD, DASH_THROUGH_MAX_SPEED, DASH_THROUGH_MISS, DASH_THROUGH_PAST, DASH_THROUGH_REACH, DASH_THROUGH_SIDE,
  HARD_GAP, SPACING_PUSH, CHARGE_DRIVE, CHARGE_SLIDE, STAMINA_OVERDRAW, STAMINA_REGEN, BODY_SIZE } from './moves';
import type { DashKind, MoveDefinition, SlotMoves } from './moves';
import { HELD } from './economy/fighters';
// Round 3e (VARIETY): what a blow does to the body it lands on, and bots that find their way.
import { comboKeyFor, comboMove, hasCombos, type ComboKey } from './combos';
import { COUNTER_DAMAGE, COUNTER_DELAY, COUNTER_STUN, DELAY_FROM, DELAY_TO, HEAVY_CHAIN_WINDOW, NEUTRAL_TECHNIQUES, WAKE_WINDOW, comboKind, isTechnique, stickDir, styleScale,
  type ComboKind, type StickDir, type TechniqueKey } from './techniques';
// Round 4b (COMBAT): a deliberate string over a mashed one; an ender's own throw; the air string's start.
import { AIR_FLING, AIR_SPIKE_DRIVE, AIR_STRING_LIFTOFF, BEAT_EARLY, ENDER_SCALING, KNOCK_DRAG, MASH_INTERVAL, MASH_SCALE, POP_LAND_STUN, RHYTHM_BONUS, SPIKE_BOUNCE } from './moves';
import { DIZZY_GUARD, DIZZY_SECONDS, LAUNCHING, OUTCOME_DOWN, OUTCOME_LIFT, SPIN_ANGLE, SPIN_SECONDS, STAGGER_GUARD, STAGGER_SPENT, WALL_BOUNCE_BACK, WALL_BOUNCE_LIFT, type Outcome } from './moves';
// Round 5 (PARRY): the guard's costs, its shove, and the Perfect Parry's rules.
import { BLOCK_DRAG, BLOCK_PUSH_ENDER, BLOCK_RECOIL, GUARD_COST, GUARD_COST_DAMAGE, GUARD_FRONT, GUARD_REAR_COST, JUST_GUARD_ADVANTAGE_KIT,
  PARRY_FREEZE, PARRY_LOCKOUT, PARRY_REACH, PARRY_REARM, PARRY_STAMINA } from './moves';
// The feel pass: the blows that hold both bodies longer (game/bigBlow.ts).
import { BIG_ENDER_HOLD, BIG_HITSTOP, BIG_LAUNCH_MOST } from './moves';
// Ground hits (8 October 2026): a fighter down on the floor is hit - a normal for less, an ultimate whole.
import { GROUND_HIT_HOLD, GROUND_HIT_MOST, GROUND_HIT_SHOVE, groundHitDamage } from './moves';
import { isBigBlow } from './bigBlow';
import { bombLead, homeStep, homeWant, inRange, BOMB_COMMIT, BOMB_HOME } from './bombAim'; // Round 8 (ULT AIM)
import { NavGrid } from './botNav';
import { LOCK_BOT_COUNTER, LOCK_COUNTER_STAMINA, LOCK_COUNTER_WINDOW, LOCK_BOT_ESCAPE, LOCK_BOT_REACT, LOCK_BOT_SPREAD, LOCK_BREAK_CASTS, LOCK_COUNTER_STUN, LOCK_ESCAPE_EARLY, LOCK_ESCAPE_WINDOW,
  LOCK_CHASE_HOLD, LOCK_DASH_FROM, LOCK_DASH_IN, LOCK_LOST, LOCK_ROUND, LOCK_ROUNDS, LOCK_STUN_MOST, LOCK_BOT_CROWD, LOCK_ESCAPE_REWIND, LOCK_THROW_FAR, LOCK_THROW_RISE, LOCK_THROW_ROOM, LOCK_THROW_TURN, LOCK_VANISH_STAMINA, LOCK_WALL_MARGIN, lockRoundMove, locks } from './lockCombat';
// Round 4b (JUMP): each fighter's own jump, 2.5-3.5x the old one.
import { AIR_CAST_BRAKE, AIR_CAST_RISE, AIR_HOME_DROP, AIR_STRIKE_BLIND, AIR_STRIKE_REACH, AIR_STRIKE_SPEED, jumpArc, jumpGravity,
  JUMP_LAND_HARD, JUMP_LAND_RECOVERY, LEAP_GROUNDED, PLUNGE_BRAKE, PLUNGE_IMPACT_DROP, PLUNGE_SNAP } from './moves';
import { AWAKENED_DAMAGE, AWAKENED_RESIST, AWAKENED_SPEED, AWAKENING_COST, AWAKENING_ENTRY,
  AWAKENING_SECONDS, AWAKENINGS, AWAKENED_MOVES, moveFor, rushMove } from './awakening';
import { traitsOf } from '../engine/sim/traits';
import { areaFalloff, isBullseye, strikeOffsets } from '../engine/sim/areaDamage';
import { blinkWindow, planTour, priorVisits, REVISIT_TURN, TIME_STOP_TOURS, tourBlows, tourContacts, visitCount, visitOf, visitVictim,
  type TimeStopTour, type TourStyle } from './timeStopBarrage';
import { STAGES, type StageId } from './stages';
import { stageColliders } from './environmentLayout';
import { AdaptiveDirector, type Difficulty } from './adaptive';
import type { AttackSlot, CollisionMovement, CollisionWorld, CombatEvent, FighterId, GameSnapshot, PlayerInput, PlayerState, ReactionKind, RoomMode, Vec3 } from './types';

const TAU = Math.PI * 2;
const slots: AttackSlot[] = ['light', 'heavy', 'special', 'ultimate', 'area'];
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** The server's rooms' lag compensation (ArenaSimulation.rewind): at most a quarter of a second back. An opponent
 *  drawn further behind than that is on a connection whose swings are resolved where they would be at a quarter
 *  second's lag; looking further back would let one player's bad line be another's hit from behind a wall. */
export const LAG_COMPENSATION = .25;
export const RISE_FROM = .9, RISE_REACH = 5.2, RISE_SPEED = 42, RISE_SETTLE = 1.5;
/** A press made chasing - the stick held at the fighter the swing is going to, within CHASE_STICK_COS - still gets the
 *  move's step-in and its steering: chasing is the stick held at them, and a step-in that turned off whenever it was
 *  held let anyone run away from every swing at a run's speed. */
const CHASE_STICK_COS = Math.cos(1.05);
/** Whether a body `dy` metres over or under the thrower is one a melee move can go for: within 1.6 m either way, as
 *  ever, or in the air over a thrower on the floor within RISE_REACH (the rising strike). */
const meleeHeight = (p: PlayerState, q: PlayerState) => {
  const dy = q.y - p.y;
  return Math.abs(dy) <= 1.6 || p.grounded && !q.grounded && dy > 0 && dy <= RISE_REACH;
};
const aimsAsLetGo = (m: MoveDefinition) => m.style === 'projectile' || (m.style !== 'bomb' && !!m.aimOnRelease);
/** How long a defeated body lies on the floor before it is respawned. It is
 *  also the death animation's own duration, so the two cannot drift apart:
 *  the renderer reads `actionTime * actionDuration` as seconds since the
 *  killing blow to decide whether the body is still falling or has settled. */
const DEFEAT_TIME = 3;
const position = (p: Vec3): Vec3 => ({ x: p.x, y: p.y, z: p.z });
const distance = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const centre = (p: Vec3): Vec3 => ({ x: p.x, y: p.y + 1.05, z: p.z });
/** A body's chest, hit radius and pushbox at its own scale. A roster fighter
 *  has no `size`, and these are exactly centre, PLAYER_RADIUS and PUSH_RADIUS. */
const centreOf = (p: PlayerState): Vec3 => p.size ? { x: p.x, y: p.y + 1.05 * p.size, z: p.z } : centre(p);
const radiusOf = (p: PlayerState) => p.size ? PLAYER_RADIUS * p.size : PLAYER_RADIUS;
const areaBlow = (off: number, radius: number) => ({ scale: areaFalloff(off, radius), bullseye: isBullseye(off, radius) });
const pushOf = (p: PlayerState) => p.girth ?? (p.size ? PUSH_RADIUS * p.size : PUSH_RADIUS);
/** Where a shot leaves its thrower: the move's own `origin` (Ikazuchi Arrow, from the Guardian's bow; once Shiden's by
 *  name), else the body's centre. */
const attackOrigin=(p:PlayerState,move:MoveDefinition):Vec3=>{const o=move.origin;return o?{x:p.x+Math.cos(p.yaw)*o.right+Math.sin(p.yaw)*o.forward,y:p.y+o.up,z:p.z-Math.sin(p.yaw)*o.right+Math.cos(p.yaw)*o.forward}:centre(p);};
/** The harbour has a canal and buildings to miss; a themed stage's ring of
 *  spawns only has to fit inside the playable rectangle - and miss its
 *  landmarks. Round 4 (STAGES): the battle royale's famous places have them
 *  inside the ring (Kami's palace, the Hollowmere Quarry houses, Magatsu's skull
 *  mounds), so a seat that would stand in one slides along the ring, then
 *  inward, to the first spot clear by two capsule radii. A seat that was
 *  already clear is where it always was. `turn` (radians) seats a Duel on its
 *  place's axis (StageDefinition.duelAxis); without it the stage's seatTurn turns the ring. */
function safeSpawn(index:number, stage:StageId, taken:readonly Vec3[]=[], turn?:number):Vec3 {
  let base=index/12*TAU;
  if(stage!=='harbor'){
    const {halfX,halfZ,spawnRadius}=STAGES[stage];
    const rx=Math.min(spawnRadius,halfX-PLAYER_RADIUS*2);
    const rz=Math.min(spawnRadius*halfZ/halfX,halfZ-PLAYER_RADIUS*2);
    // Round 4b (MAPS): the seats are spaced evenly round the ellipse, not by
    // angle - on a long stage (Wreckers' Causeway's bridge is 26 by 104 m) equal
    // angles bunched the seats at its ends 6-8 m apart. A circle is unchanged.
    // A Duel's axis is its own line from +z; anything else is the ring, turned by the landmarks round's seatTurn, if any.
    base=turn===undefined?ellipseSeat(index/12+(STAGES[stage].seatTurn??0)/TAU,rx,rz):ellipseSeat(index/12,rx,rz)+turn;
    const room=(x:number,z:number)=>Math.abs(x)<=halfX-PLAYER_RADIUS*2&&Math.abs(z)<=halfZ-PLAYER_RADIUS*2;
    for(const scale of [1,.85,1.15,.7,1.3,.55,.4])for(const offset of [0,.08,-.08,.16,-.16,.24,-.24,.36,-.36,.5,-.5]){
      const x=Math.sin(base+offset)*rx*scale,z=Math.cos(base+offset)*rz*scale;
      if(room(x,z)&&clearOfLandmarks(stage,x,z)&&taken.every(t=>Math.hypot(t.x-x,t.z-z)>2.5))return {x,y:0,z};
    }
    return {x:Math.sin(base)*rx,y:0,z:Math.cos(base)*rz};
  }
  for(const radius of [36,30,24,18,12])for(const offset of [0,.08,-.08,.16,-.16]){
    const p={x:Math.sin(base+offset)*radius,y:0,z:Math.cos(base+offset)*radius};
    const water=p.z < -27 && p.z > -43 && Math.abs(Math.abs(p.x)-27)>3.5;
    if(!water&&!ARENA_COLLIDERS.some(c=>Math.abs(p.x-c.x)<c.halfX+.9&&Math.abs(p.z-c.z)<c.halfZ+.9))return p;
  }
  return {x:Math.sin(base)*9,y:0,z:Math.cos(base)*9};
}

/** The angle at which a share `t` (0-1) of an ellipse's perimeter lies,
 *  measured from +z as the seats are (x = sin, z = cos). */
function ellipseSeat(t:number,rx:number,rz:number){
  t=((t%1)+1)%1;
  if(Math.abs(rx-rz)<1e-6)return t*TAU;
  const N=96,arc=[0];
  for(let i=1;i<=N;i++){const a=(i-.5)/N*TAU;arc.push(arc[i-1]+Math.hypot(rx*Math.cos(a),rz*Math.sin(a))*TAU/N);}
  const want=t*arc[N];
  let i=1;while(i<N&&arc[i]<want)i++;
  const f=(want-arc[i-1])/Math.max(arc[i]-arc[i-1],1e-9);
  return (i-1+f)/N*TAU;
}

/** Round 4 (STAGES): whether a fighter standing here clears every landmark of
 *  the stage by two capsule radii (overhead ones - a gate's beam - aside). */
function clearOfLandmarks(stage:StageId,x:number,z:number){
  const gap=PLAYER_RADIUS*2;
  return !stageColliders(stage).landmarks.some(c=>c.y-c.halfY<1.8&&Math.abs(x-c.x)<c.halfX+gap&&Math.abs(z-c.z)<c.halfZ+gap);
}
/** The nearest clear spot to a wanted one, searching outward in rings - the
 *  wanted spot itself wherever nothing stands on it. */
function clearSpot(stage:StageId,want:Vec3):Vec3 {
  if(clearOfLandmarks(stage,want.x,want.z))return want;
  const {halfX,halfZ}=STAGES[stage];
  for(let r=1;r<=24;r++)for(let k=0;k<16;k++){
    const a=k/16*TAU,x=want.x+Math.sin(a)*r,z=want.z+Math.cos(a)*r;
    if(Math.abs(x)<=halfX-PLAYER_RADIUS*2&&Math.abs(z)<=halfZ-PLAYER_RADIUS*2&&clearOfLandmarks(stage,x,z))return {x,y:want.y,z};
  }
  return want;
}
/** How far a training pair may stand apart on this stage. The Proving Hall is
 *  21 m deep, so the harbour's z = -12 and z = -16 would both be in the wall. */
function trainingReach(stage:StageId){ return Math.min(12, STAGES[stage].halfZ - 2); }
function trainingSpawn(index:number, stage:StageId):Vec3 {
  const {halfX}=STAGES[stage];
  const spread=Math.min(4,(halfX-PLAYER_RADIUS*2)/2);
  return clearSpot(stage,{ x: (index % 5 - 2) * spread, y: 0, z: trainingReach(stage) * .25 });
}

interface Cinematic { at: number; ids: string[]; evade: number[]; pins?: Vec3[]; from?: Vec3; own: number; done?: boolean }

interface Cast {
  /** Which of this fighter's casts it is. Contacts used to be credited to
   *  whatever cast of the same SLOT was running when they landed, so a ki
   *  blast from one rush stage that arrived during the next marked the new
   *  stage connected and stamped its input sequence on the hit. */
  id: number;
  /** Rush stage, for a light: 0 is the fighter's own light. 0 otherwise. */
  stage: number;
  /** Lock combat: which round of its string a light stage is (0 the first). */
  round?: number;
  slot: AttackSlot;
  /** The combo ender this heavy or special is (combos.ts), where it is one. */
  branch?: ComboKey;
  /** A ground smash (MoveDefinition.plunge) that has reached the floor: its clock now runs from the landing. */
  landed?: boolean;
  /** Round 4b (JUMP): the height a ground smash's dive left from, once it has. */
  plungeFrom?: number;
  /** Round 4b (JUMP): an air strike's dive (airborneOpener): the velocity it flies at, gravity off, until its blow. */
  dive?: { x: number; y: number; z: number; until: number; rise?: true };
  /** The fighter a melee move thrown from the floor went for: if they leave the floor before its blow, it rises to
   *  meet them (risingStrike). */
  riseOn?: string;
  move: MoveDefinition;
  start: number;
  networkHold?: number;
  nextContact: number;
  /** Melee contacts whose hitbox is open and has not yet found anybody, with
   *  the time it closes. A contact used to be tested on the single tick it
   *  came due and then thrown away, so a swing missed by a centimetre on that
   *  one frame passed visibly through the target and did nothing at all. */
  live?: { index: number; until: number }[];
  direction: Vec3;
  endpoint: Vec3;
  /** Nearby target admitted when Taisei starts melee; never acquire a distant one mid-combo. */
  lungeTargetId?: string;
  /** Whom a charge-in or an iai draw was aimed at when it started. */
  aimId?: string;
  /** Arcade survival: the horde body a swing turned to (see AimAssist), which
   *  its approach homes on as it would on a fighter. */
  externalAim?: string;
  /** A charge-in thrown with the opponent on top of it (MoveDefinition.chargeIn)
   *  slides back during its early charge: `backstepPlanned` metres in all,
   *  `backstep` still to go, done by cast age `backstepUntil`. */
  backstep?: number;
  backstepPlanned?: number;
  backstepUntil?: number;
  /** An iai draw's dash (MoveDefinition.dashThrough), once it has started:
   *  the line it runs, from where the fighter stood to past the target. */
  through?: { from: Vec3; to: Vec3 };
  /** Round 3: a time-stop ultimate's crossing of its stop (timeStopTour). */
  tour?: TimeStopTour;
  /** Round 3d (ULTS): a hit-confirm ultimate's cinematic, once its opener has
   *  landed (ultimateTick), and the server time its opener was found to have
   *  missed instead (whiffUltimate). */
  cine?: Cinematic;
  whiff?: number;
  /** Round 3d (ULTS): the whole move, while a hit-confirm ultimate's opener
   *  that is a shot flies as a move of its own (see ultimateTick). */
  full?: MoveDefinition;
  /** Set once this move has landed on anyone. Only a move that connected may be
   *  cancelled into the next one, so a whiff stays fully committed. */
  connected: boolean;
  /** Started off the ground, and so holds its height while it plays out. */
  airborne: boolean;
  /** Who this cast has already landed on, and the breaker count it opened
   *  on for each of them. The breaker budget is charged once per cast, on
   *  the first contact to land, and a multi-contact finisher reads its stun
   *  scale off the count the cast opened on rather than whatever has
   *  happened since. Shared with the projectiles the cast releases, which
   *  can land after the cast itself is over. */
  opened: Map<string, number>;
  /** Cloudstep (MoveDefinition.teleport), once it has vanished:
   *  where the thrower stood, whom it went for, and - once it is back -
   *  where it came back. */
  blink?: { from: Vec3; targetId?: string; to?: Vec3 };
  /** Round 4b (COMBAT): a combo ender pressed on the beat (RHYTHM_BONUS), and a light stage thrown while its fighter
   *  was mashing (MASH_SCALE). Copied onto the shots it lets go, which can land after it is over. */
  beat?: boolean;
  mash?: boolean;
  /** Techniques (techniques.ts): a counter stance that met a blow - its own blow comes at once, and is worth
   *  COUNTER_DAMAGE of itself. */
  countered?: boolean;
}
/** The controller's answer for a body that is standing still on the floor: no travel, still grounded (see ArenaSimulation.atRest). */
const AT_REST: CollisionMovement = Object.freeze({ x: 0, y: 0, z: 0, grounded: true });
/** The knockback (metres a second) below which a body on the floor is taken for standing still on a follower's copy: the tail
 *  of a shove decays as exp(-7t) and takes two seconds to fall under a millionth, while a twentieth of a metre a second is
 *  under a millimetre a tick, which the next snapshot puts right. */
const REST_DRIFT = .05;

interface Actor {
  inputGap?: number;
  /** Lag compensation (ArenaSimulation.rewind): how far behind this tick the
   *  fighters this player sees are drawn, from its last input's `view`. */
  viewLag?: number;
  motionNetworkHold?: number;
  state: PlayerState;
  input: PlayerInput;
  lastSeq: number;
  lastInputAt: number;
  vy: number;
  kx: number;
  kz: number;
  knockbackDrag: number;
  launchSlot?: AttackSlot;
  /** Which reaction the target is in while stunned, so a jab, a launcher and a
   *  guard break do not all play the same animation. */
  reaction: ReactionKind | null;
  /** The impact freeze as a window on the server clock. The published boolean
   *  is sampled on the broadcast grid, which rounds a 0.08 s light freeze up to
   *  the snapshot interval and makes two identical hits weigh differently
   *  depending on which tick they landed on; the window does not. */
  hitstopFrom: number;
  hitstopUntil: number;
  /** How long the current stagger's clip runs for, which is not how long the
   *  fighter is held. The stun floor below can double a light's hitstun, and
   *  the client remaps the hurt clip onto actionDuration, so handing it the
   *  whole window plays the flinch at half speed. */
  reactionClip: number;
  comboUntil: number;
  stunUntil: number;
  freezeUntil: number;
  evadeUntil: number;
  dashUntil: number;
  dashX: number;
  dashY: number;
  dashZ: number;
  dashSpeed: number;
  /** A ground dash is shaped around the run it interrupts. `dashEntry` is
   *  the along-axis ground speed on the tick the dash began, which the rise
   *  is floored at so a sprinter is not planted for a frame; `dashPlateau`
   *  scales the flat of the trapezoid so the ground the dash covers is what
   *  it was before either floor was added. See shapeGroundDash. */
  dashEntry: number;
  dashPlateau: number;
  /** How long this dash runs and which kind it is. A backdash and a sidestep
   *  are shorter than the forward dash; the kind is server-internal for now -
   *  PlayerState has no field for it, and the renderer picks its clip off the
   *  action alone. */
  dashSeconds: number;
  dashKind: DashKind;
  /** Off the floor by their own jump, as opposed to a launch, an air cast or
   *  a reaction. Only a jump falls at FALL_GRAVITY. Cleared on landing and on
   *  being hit. */
  jumping: boolean;
  /** Hits taken without touching the floor. Each lifts less than the last. */
  juggleHits: number;
  /** When each command was last pressed, so a press made a few frames early
   *  still fires the moment it becomes legal. */
  jumpAt: number;
  /** When the current jump left the floor, for the short hop. */
  jumpStartedAt: number;
  /** Round 4b (JUMP): when the fighter last touched down (-Infinity: on the floor since it was placed), whether the
   *  jump under way leapt, and when a full jump's landing lets the next jump or dash go (LEAP_GROUNDED,
   *  JUMP_LAND_RECOVERY). */
  groundedAt: number;
  leapt: boolean;
  landedUntil: number;
  dashAt: number;
  attackAt: number;
  attackSeq?: number;
  attackYaw?: number;
  attackAim?: { x: number; z: number };
  /** How long an attack press stays live. Every light's cooldown outlasts its
   *  own duration - Kenzo's is 0.95 s against a 0.90 s swing - so a flat 0.18 s
   *  buffer ran out between 20 and 50 ms before the press would have been
   *  legal, and the follow-up jab was eaten in silence. The press survives
   *  until the move that is running could accept it, and no longer. */
  attackHold: number;
  /** Which press a cooldown refusal has already been announced for. A press
   *  that waits out a cooldown is retried every tick; undeduped that is eleven
   *  HUD notices for one button. */
  attackNotified: number;
  awakenAt: number;
  /** While the transformation plays: immobile, invulnerable, and not a
   *  reaction, so the pose is its own action rather than a stagger. */
  awakenEntryUntil: number;
  attackSlot?: AttackSlot;
  cast: Cast | null;
  respawnAt: number;
  nextBotThink: number;
  lastDamageAt: number;
  /** Two counters for one string. `chainHits` is the breaker's budget: one
   *  per cast, reset by the breaker itself. `scalingHits` drives damage
   *  scaling: every contact, decaying only on the 1.2 s quiet timer - the
   *  breaker is a defensive escape and must not hand the attacker a fresh
   *  1.0x for having been escaped from. */
  chainHits: number;
  scalingHits: number;
  spawn: Vec3;
  /** When the press now held opened its Perfect Parry window: -Infinity when
   *  it opened none (the button not up for PARRY_REARM first, or a whiffed
   *  window's lockout running), or once that window has closed. Holding the
   *  guard never re-arms it; the window belongs to the press. */
  guardAt: number;
  wasGuarding: boolean;
  /** The raw button, and when it was last pressed from nothing. Kept apart
   *  from `wasGuarding` because the pose is forced down by blockstun. */
  guardHeld: boolean;
  guardPressedAt: number;
  /** Round 5 (PARRY): when the button last came up (a press arms the window
   *  only after PARRY_REARM of it), whether the open window has caught a
   *  blow, and until when a window that caught nothing locks the next ones
   *  out (PARRY_LOCKOUT). */
  guardReleasedAt: number;
  parryCaught: boolean;
  parryLockUntil: number;
  /** Round 5 (PARRY): until when a parry's punish is this fighter's: an
   *  attack pressed with the guard still held drops the guard and goes out
   *  rather than waiting on the button. */
  counterUntil: number;
  /** Round 5 (PARRY): until when this fighter, parried, reels: the floor of
   *  any stun a blow gives them inside it. Public (REACTION_KEYS). */
  parriedUntil: number;
  /** Driven into the floor by a finisher, so the landing bounces. */
  bounceOnLand: boolean;
  /** v70 (moves.ts LAUNCH_LEAD): a launcher's throw running ahead of its arc - how far at most (metres; 0: none), over
   *  how long a rise (seconds) and how much of it the body has flown. */
  launchLead: number; launchSpan: number; launchRun: number;
  /** Round 3e (VARIETY): what the last blow's outcome (moves.ts Outcome)
   *  left on this body. How long it stays down when it lands, where that is
   *  not KNOCKDOWN_SECONDS; whether a wall it is blown into throws it back
   *  (and whose blow it was, to re-open their chase); the part of a spin-out
   *  turn still to make and how fast, radians; when it was last staggered or
   *  spun (STAGGER_GUARD). */
  downFor?: number;
  wallBounce?: boolean;
  wallBounceBy?: string;
  spinLeft?: number;
  spinRate?: number;
  staggeredAt?: number;
  /** When a string's dizzy (combos.ts) last dazed it: one in DIZZY_GUARD. */
  dizzyAt?: number;
  /** A dizzy that caught it in the air (a juggle string's third blow had popped it): it is driven down, and lands
   *  dazed instead of down. */
  dizzyOnLand?: boolean;
  /** (combos.ts) Presses made while a light was still waiting, in order, for a fighter with enders: Light, Light,
   *  Light, Heavy thrown faster than a heavy body's string plays is still that, not the last press alone. */
  pressQueue?: AttackSlot[];
  /** 0 to 1, fixed for the life of this fighter. Only bots read it: it sets
   *  how often they press, how fast they think and which way they circle. */
  botSkill: number;
  /** Ground velocity under this fighter's own feet, in m/s. Separate from
   *  knockback and from the dash, both of which override it outright. */
  mx: number;
  mz: number;
  /** Held in a guard by a blocked hit. Distinct from `stunUntil`, which this
   *  also raises: it is what tells the action picker to keep showing the guard
   *  instead of a hurt. */
  blockedUntil: number;
  /** How many casts this fighter has thrown, for `Cast.id`. */
  castSerial: number;
  /** The rush string between stages. When a light stage finishes on its own
   *  clock, `rushStage` is the stage it was and `rushUntil` how long a light
   *  press still continues the string (RUSH_WINDOW); `rushOpened` is who the
   *  string has already charged to the breaker, handed on to the next stage.
   *  Anything else that ends the cast - a cancel, being hit, a dash, a guard -
   *  leaves the window shut. */
  rushStage: number;
  rushUntil: number;
  rushOpened: [string, number][];
  /** Whom this fighter's last launching hit sent flying, and until when a
   *  dash chases them (CHASE_WINDOW). */
  chaseTargetId?: string;
  chaseUntil: number;
  /** Until when a LIGHT press chases that body too (LIGHT_CHASE_WINDOW):
   *  opened only by a launch from the rush finisher or a heavy. */
  lightChaseUntil: number;
  /** The dash running now is a chase: it keeps its bare shape and its
   *  aim, holds an attack pressed during it for its arrival, and flies
   *  without gravity until it gets there. */
  dashChase: boolean;
  /** When this fighter last vanished, and behind whom. For VANISH_AIM after
   *  it they keep facing that back and their melee aims at it whatever the
   *  camera says; VANISH_COOLDOWN after it they may vanish again. */
  vanishedAt: number;
  vanishOn?: string;
  /** Lock combat (lockCombat.ts). As an attacker: the round of the string that ran last (`rushStage`'s round), and
   *  until when its next move waits out the beat before the finisher (LOCK_FINISH_BEAT). As a defender: whose round has just ended
   *  on them, the escape window [lockFrom, lockTo], and whether it opened shut (a guard mashed during the round). */
  lockRound: number;
  lockGapUntil: number;
  lockBy: string;
  lockFrom: number;
  lockTo: number;
  lockBarred: boolean;
  /** Lock combat (lockClear): sliding off a string's blow other than its finisher, which never splats it on what stops it -
   *  a wall, or the page's floor (in the training hall a seam in it splatted Ouga mid-string, three metres from any
   *  wall). Public (REACTION_KEYS); left unset outside a lock string, so the live rules' snapshots are as they were. */
  lockSlide?: true;
  /** Lock combat: whom this attacker may counter-vanish behind, until when (LOCK_COUNTER_WINDOW). */
  lockCounterOn: string;
  lockCounterUntil: number;
  /** Round 3b (TARGET): the body a soft-target cast picked (chooseIntent) and
   *  the id of that cast. It is the cast's target for as long as it runs
   *  (intentTick), and the body the string's next stage stays on. */
  intent: string | null;
  intentCast: number;
  /** The way the body faced as this tick began, before a press turned it to
   *  the view: where the fighter last travelled, or its last move's aim. */
  faceYaw: number;
  /** Cloudstep: until when this body is gone from the arena (see
   *  `blink`). Public, so a client's copy of it - which has no cast to read -
   *  lets the local fighter through it exactly as the server does. */
  goneUntil?: number;
  /** Round 3d (ULTS): the cast whose cinematic this fighter holds somebody
   *  in, and whom - so a hold its cast did not end itself (the thrower
   *  defeated, the practice room reset, the match won) is let go of on the
   *  next tick (cinematicTick). */
  holding?: { cast: number; ids: string[] };
  /** Bots only: the last opposing cast this bot has decided whether to
   *  parry, so the roll is made once per swing rather than once per tick. */
  botRead?: string;
  /** Round 5 (PARRY), bots only: the span over which this bot means to hold
   *  its guard - a parry it has timed, a block it has raised, or a guard it
   *  is turtling behind (botDefend). */
  botGuardFrom?: number;
  botGuardUntil?: number;
  /** Round 5 (PARRY), bots only: the planned guard is a parry it has timed. */
  botTimed?: boolean;
  /** Round 5 (PARRY), bots only: its bar spent, it is getting it back. */
  botWinded?: boolean;
  /** Arcade survival only; every field below is absent on a roster fighter in
   *  a royale, training or private room, and every rule that reads one falls
   *  back to exactly what it did before. See `addCombatant`. */
  /** The moves of a body that is not one of the roster. No rush string. */
  kit?: SlotMoves;
  forged?: Record<AttackSlot, MoveDefinition>;
  /** What a landed finisher left on this body (VOL.3 part two): a burn ticking, a slow, a freeze and the immunity after
   *  it. Part of the rollback checkpoint, as a slow changes how its owner runs. */
  statuses?: { burn?: { until: number; dps: number; from: string; next: number }; slow?: { until: number; factor: number };
    freeze?: { until: number }; immuneUntil?: number };
  /** Driven from outside through `command`; the bot brain never runs. */
  external?: boolean;
  /** Body scale: hit volume, pushbox and chest height. */
  size?: number;
  /** Damage it absorbs before it staggers, and what it refills to. */
  poise?: number;
  poiseMax?: number;
  /** When a broken body may be poised again. */
  poiseBrokenUntil?: number;
  /** A combo breaker at BREAK_CASTS. Off for fodder, which is there to be juggled. */
  breaker?: boolean;
  /** Attack armour (a light or heavy trades with a committed move rather
   *  than cancelling it). Off for fodder: any blow knocks it out of a swing. */
  armour?: boolean;
  /** Never launched: a body too big to throw into the air (a giant). */
  anchored?: boolean;
  mods?: CombatMods;
  /** Until when a horde blow only chips this fighter (MINOR_GRACE). */
  minorArmourUntil?: number;
  /** The tick this fighter last froze on landing a blow on the horde: one
   *  swing through twenty bodies freezes once, not twenty times. */
  externalFreezeTick?: number;
  /** A horde body the player chose (the lock or the auto target). */
  chosenExternal?: string;
  /** The ball rooms (AimAssist.sport): boosting - a ground dash run on at the boost's speed while the stick holds and
   *  the stamina lasts - and the jumps taken off the floor since this body last stood on it. */
  boosting: boolean;
  airJumps: number;
  /** Round 4b (COMBAT): when this fighter last pressed light, and how many lights in a row came sooner than
   *  MASH_INTERVAL after the one before - mashing. */
  lightPressAt: number;
  /** Techniques (techniques.ts): the stick at the last press (submitInput); the Delayed Strike's beat after a string's
   *  second blow (DELAY_FROM, DELAY_TO); the heavy string's window after a landed heavy, and which blow it would be; when
   *  each technique thrown from neutral is ready again; the kinds of technique the combo landing on this body is built
   *  from (a bit each, comboKind), which its style is worth; and, for a bot reading its attacker, the casts of that
   *  combo (`routeNow`) and the openings of the last few (`seenRoutes`). */
  attackDir: StickDir;
  /** Techniques: when this fighter last got up off the floor (the Wake-up Strike's window, WAKE_WINDOW). */
  risenAt: number;
  delayFrom: number;
  delayUntil: number;
  heavyChainUntil: number;
  heavyChainStage: number;
  techniqueReady: Partial<Record<TechniqueKey, number>>;
  comboKinds: number;
  routeNow: string;
  routeCast: string;
  seenRoutes: string[];
  mashStreak: number;
  /** The string running was mashed into: its light stages are worth MASH_SCALE (fighter against fighter). */
  stringMash: boolean;
  /** A heavy or a special pressed sooner than MASH_INTERVAL after a light: never on the beat. */
  enderRushed: boolean;
  /** Round 4b (COMBAT): what the press waiting in `attackSlot` was: an ender pressed on the beat (see onBeat), and a
   *  light pressed at a pace rather than mashed (a timed light, which is what a light chase needs). */
  attackBeat: boolean;
  attackPaced: boolean;
  /** Round 4b (COMBAT): popped by a stage before the finisher of a string: it lands on its feet, reeling
   *  (POP_LAND_STUN), not down. And how long a dizzy that caught it in the air holds once it lands (MoveDefinition.daze;
   *  0: DIZZY_SECONDS). */
  popLand: boolean;
  dazeFor: number;
  /** Round 4b (COMBAT): the knockdown ender that threw it (MoveDefinition.knock), for its landing: a spike bounces once,
   *  low (SPIKE_BOUNCE), and a slide keeps skidding along the floor once it is down. */
  knockKind: '' | 'spike' | 'slide';
  /** Ground hits (moves.ts GROUND_HIT_SCALE): the latest a body down on the floor may be kept there by the blows it
   *  takes - when it would have got up as it went down (a knockdown's landing, a wall splat), and GROUND_HIT_MOST. A
   *  freeze holds it with the rest of its clocks. Public (REACTION_KEYS): the client's copy lands its blows as the server
   *  does. */
  floorUntil: number;
  /** Ground hits 2 (moves.ts GROUND_HIT_SCALES): this stay on the floor's ledger - the ground hits it has taken, and the
   *  health they took (GROUND_HIT_BUDGET). Opened where `floorUntil` is set; public, as it is. */
  floorHits: number;
  floorTaken: number;
}
/** Round 4b (COMBAT): a fighter's press clock and string marks as they stand with nothing pressed (addPlayer, respawn). */
const pressClock = () => ({ lightPressAt: -Infinity, mashStreak: 0, stringMash: false, enderRushed: false, attackBeat: false,
  attackPaced: false, popLand: false, dazeFor: 0, knockKind: '' as const,
  // Ground hits: nothing has put it on the floor, and no stay there has a ledger.
  floorUntil: -Infinity, floorHits: 0, floorTaken: 0,
  // Lock combat: no round run, no gap open.
  lockRound: 0, lockGapUntil: -Infinity, lockBy: '', lockFrom: -Infinity, lockTo: -Infinity, lockBarred: false,
  lockCounterOn: '', lockCounterUntil: -Infinity,
  // Techniques: nothing pressed, no beat or heavy chain open, every technique ready, no combo on the body, nothing read.
  attackDir: 'n' as StickDir, risenAt: -Infinity, delayFrom: -Infinity, delayUntil: -Infinity, heavyChainUntil: -Infinity, heavyChainStage: 0,
  techniqueReady: {} as Partial<Record<TechniqueKey, number>>, comboKinds: 0, routeNow: '', routeCast: '', seenRoutes: [] as string[] });

/** What an arcade upgrade or an enemy's tier changes about a combatant. Every
 *  factor is 1 (and every chance 0) unless survival sets it. */
export interface CombatMods {
  damageOut: number;
  damageIn: number;
  speed: number;
  knockbackIn: number;
  stunIn: number;
  cooldown: number;
  stamina: number;
  meterGain: number;
  awakenGain: number;
  /** Fraction of the damage a blow deals that heals its thrower. */
  lifesteal: number;
  /** Chance a blow is a critical, and what a critical multiplies. */
  crit: number;
  critDamage: number;
  /** Seconds added to the awakening window. */
  awakenSeconds: number;
  /** Stamina back a second on top of the resting regen, even mid-string. */
  staminaRegen: number;
  /** Multiplier for resting recovery, without changing when recovery is allowed. */
  staminaRecovery?: number;
}
export const NEUTRAL_MODS: Readonly<CombatMods> = { damageOut: 1, damageIn: 1, speed: 1, knockbackIn: 1, stunIn: 1,
  cooldown: 1, stamina: 1, meterGain: 1, awakenGain: 1, lifesteal: 0, crit: 0, critDamage: 2, awakenSeconds: 0, staminaRegen: 0 };

/** A combatant that is not a roster fighter: an arcade enemy or boss. */
export interface CombatantSpec {
  /** Stands in `PlayerState.fighter`, which the type requires. Pick one with
   *  no special cases; nothing reads it while `kit` is set. */
  fighter?: FighterId;
  name?: string;
  enemy?: string;
  team: string;
  kit: SlotMoves;
  maxHp: number;
  size?: number;
  poise?: number;
  breaker?: boolean;
  mods?: Partial<CombatMods>;
  spawn: Vec3;
  yaw?: number;
  armour?: boolean;
  anchored?: boolean;
  girth?: number;
}

/** A body outside the arena's actors that a fighter's blows still land on:
 *  arcade survival's horde (src/survival/horde), hundreds of grunts too many
 *  to simulate as fighters. The arena does everything a blow does to whoever
 *  THREW it - the cancel it opens, the combo count, the meter, lifesteal, the
 *  critical roll, the impact freeze and the `hit` event - and hands what it
 *  does to the body to the horde. Absent everywhere else, where every rule
 *  below reads exactly as it did. */
export interface ExternalBody { id: string; x: number; y: number; z: number; radius: number; height: number; airborne: boolean }
export interface ExternalBlow {
  attackerId: string; slot: AttackSlot; move: MoveDefinition; damage: number; critical: boolean; finisher: boolean;
  /** Which way along the floor the blow drives the body (a unit vector). */
  pushX: number; pushZ: number;
  knockback: number; stun: number;
  /** A finisher heavy enough to throw somebody (LAUNCH_KNOCKBACK), or any blow on a body already in the air. */
  launch: boolean;
  hitstop: number;
}
export interface ExternalTargets {
  /** Optional allegiance filter for modes with allied and hostile compact units. */
  hostile?(attackerId:string,body:ExternalBody):boolean;
  /** Every body whose hit volume may touch the capsule from `a` to `b` of `radius`: written into `out`, the count returned. */
  query(a: Vec3, b: Vec3, radius: number, out: ExternalBody[]): number;
  /** A blow reaches a body; what it did, or null when it could not land (dying, still coming out of a rift). */
  receive(body: ExternalBody, blow: ExternalBlow): { damage: number; reaction?: ReactionKind; killed: boolean } | null;
  /** Time stopped around a point. */
  freeze(centre: Vec3, radius: number, seconds: number, attackerId?:string): void;
  /** Where a body is now, for a swing homing on it. */
  locate(id: string): ExternalBody | undefined;
}
/** Arcade survival's hack-and-slash aim: a swing turns to the nearest enemy
 *  all the way round, and homes up to `magnet` metres past its own reach. */
export interface AimAssist { magnet: number;
  /** The ball modes: an air strike (airHeavy) with no fighter to dive at flies at the chosen external body (the ball) to
   *  meet it on the blow, above the thrower as well as below, instead of diving blind to the floor. */
  airExternal?: boolean;
  /** The ball modes' sports movement (game/ball/model.ts BALL_SPORT): set by the ball rooms and the page's prediction of
   *  one, and by nothing else, so every other mode moves exactly as it did. */
  sport?: SportFeel }
/** How a body moves in a ball room: a sport's movement, not a fight's. Speeds are metres a second, times seconds. */
export interface SportFeel {
  /** The run, in place of 7.5; and the ground ramp's rates (start, stop, turn) times `feet`. */
  run: number; feet: number;
  /** Boost: a forward dash on the floor hands back `boost` instead of the run and holds it for as long as the stick does
   *  and the stamina lasts, spending `boostDrain` a second (the stamina bar is the boost meter); the next dash may come
   *  `dashGap` after one ends (0.35 elsewhere). */
  boost: number; boostDrain: number; dashGap: number;
  /** The jump's take-off speed times `jump`; `airJumps` more jumps off the floor before the feet are back on it, each
   *  leaving at `airJump` times the take-off speed; a running jump carried at no more than `leap` along the floor. */
  jump: number; airJumps: number; airJump: number; leap: number;
  /** A dash in the air goes at the chosen body (the ball) when it is within `airDash` metres and on the way the stick
   *  says: the aerial. 0: a flat air dash as elsewhere. */
  airDash: number;
  /** Every impact freeze (hitstop) times this. */
  hitstop: number;
  /** A light or heavy melee blow struck in full is over this long after its last contact (its tail cut): the body is
   *  free to strike, jump or dash again while the clip would still be recovering. */
  recovery: number;
}
/** A blow from the horde's rank and file: a fighter in the middle of a move
 *  trades with it, and one it has just flinched only chips for MINOR_GRACE,
 *  so a crowd can hurt a fighter but never hold them in a stagger. */
const MINOR_GRACE = .9;
/** Round 5 (PARRY): how a bot meets a blow it has read (botDefend), from the
 *  least skilled bot to the most (botSkill 0 to 1): the chance it tries to
 *  parry, the chance it blocks instead, and the spread of its timing in
 *  seconds round the middle of the parry window. A custom room's Easy is 0.1,
 *  Normal 0.5, Hard 0.95 (social/custom.ts); a royale draws each bot's. How
 *  far ahead a blow is read, and how often a bot close to somebody turtles. */
const BOT_PARRY = [.03, .3] as const;
const BOT_BLOCK = [.2, .5] as const;
const BOT_TIMING = [.07, .045] as const;
const BOT_READ = .4;
const BOT_TURTLE = [.12, .2] as const;
const BOT_REACTION = [.34, .24] as const;
const BOT_REACTION_SPREAD = .03;
const BOT_PARRY_LEAD = .03;
const BOT_GUARD_LEAD = .19;
/** A number in [-1, 1] fixed by a key: one bot's reaction to one blow, the same however often it is asked, and off
 *  the simulation's seeded stream so every other roll keeps its place in it. */
const unitSpread = (key: string) => {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967295 * 2 - 1;
};
/** The bar a bot wants before it raises a guard to block or turtle behind. */
const BOT_GUARD_STAMINA = 30;
/** Below `[0] + [2] * skill` of its bar a bot is winded until it has `[1]` more back (thinkBot). */
const BOT_WINDED = [8, 18, 14] as const;
/** The ultimate meter a blow on the horde builds, against a blow on a
 *  fighter: a swing through a crowd lands a dozen times. */
const EXTERNAL_METER = .45;
/** And a detached blow (an art striking on its own) a share of that: arts
 *  land on dozens at a time, and would fill the meter by themselves. */
const DETACHED_METER = .35;

/** Techniques (techniques.ts): a bit for each kind of technique a combo is built from (Actor.comboKinds), and how many it
 *  holds. */
const KIND_BIT: Readonly<Record<ComboKind, number>> = { string: 1, ender: 2, heavy: 4, opener: 8, counter: 16, delay: 32, air: 64, special: 128, ultimate: 256, area: 512 };
const bitCount = (bits: number) => { let n = 0; for (let b = bits; b; b &= b - 1) n++; return n; };
/** What a bot reads of the combos landed on it (familiarity): the openings of the last ROUTES_KEPT, each its first
 *  ROUTE_HEAD + 1 casts; a combo's own record is cut at ROUTE_CHARS. A route it has seen ROUTE_KNOWN times is one it
 *  knows: it escapes, parries and blocks it more (botLockEscape, botAnswer). */
const ROUTES_KEPT = 8, ROUTE_HEAD = 3, ROUTE_CHARS = 64, ROUTE_KNOWN = 3, ROUTE_GAP = .6;
/** How much more a bot that knows the route it is caught in escapes it (a share added to LOCK_BOT_ESCAPE's), parries
 *  and blocks it. */
const READ_ESCAPE = .38, READ_PARRY = .25, READ_BLOCK = .2, READ_COUNTER = .22, READ_SLIP = .1;

/** Owner-only rollback data. Transform snapshots alone cannot rewind acceleration,
 * dash/jump timers, buffered inputs or an in-flight cast. Maps have a wire format. */
export type PredictionCheckpoint = Omit<Actor,'state'|'cast'> & {
  cast: (Omit<Cast,'opened'> & {opened:[string,number][];openedGroup:number}) | null;
  shots: (Omit<Projectile,'opened'> & {opened:[string,number][];openedGroup:number})[];
};
/** Public reaction kinematics; no opponent input, attack buffers or queued commands. */
const REACTION_KEYS=['vy','kx','kz','knockbackDrag','reaction','reactionClip','stunUntil','evadeUntil',
  'hitstopFrom','hitstopUntil','freezeUntil','blockedUntil','lastDamageAt','launchSlot','bounceOnLand',
  'juggleHits','chainHits','scalingHits','comboKinds','jumping','jumpStartedAt','dashUntil','mx','mz','goneUntil',
  // Round 4b (COMBAT): how the body lands from a string's pop, a knockdown ender's spike or slide, and an air dizzy.
  'popLand','knockKind','dazeFor',
  // Round 5 (PARRY): how long a parried thrower reels, whatever lands on them inside it.
  'parriedUntil',
  // Ground hits: how long the blows a body on the floor takes may keep it there (GROUND_HIT_MOST), and what this stay
  // has cost it (ground hits 2: GROUND_HIT_SCALES, GROUND_HIT_BUDGET).
  'floorUntil','floorHits','floorTaken',
  // v70: a launcher's throw, ahead of its arc (moves.ts LAUNCH_LEAD).
  'launchLead','launchSpan','launchRun',
  // Lock combat: a string's slide, which never splats (lockClear).
  'lockSlide'] as const;
export type ReactionCheckpoint=Pick<Actor,typeof REACTION_KEYS[number]>;
interface Projectile {
  actorId: string;
  /** Round 3c (LOCK): the body it was thrown at - the thrower's target as it
   *  left the hand - which inLane never keeps it off. */
  aimId?: string;
  fighter: FighterId;
  slot: AttackSlot;
  move: MoveDefinition;
  start: Vec3;
  end: Vec3;
  startAt: number;
  duration: number;
  previous: Vec3;
  opened: Map<string, number>;
  /** The cast that released it (`Cast.id`) and that cast's rush stage. A shot
   *  outlives its cast, and the hit it lands is still that cast's. */
  castId: number;
  stage: number;
  /** Horde bodies a piercing shot has already torn through. */
  pierced?: Set<string>;
  /** Round 4b (COMBAT): its cast's (Cast.beat, Cast.mash). */
  beat?: boolean;
  mash?: boolean;
  /** Round 8 (ULT AIM): a bomb aimed as it is let go (MoveDefinition.aimOnRelease): its blast point as it was let go,
   *  which its following the body in flight never takes `end` further than BOMB_DRIFT from (homeBomb). */
  aimed?: Vec3;
}

export interface SimulationOptions {
  roomMode?: RoomMode;
  /** Adaptive difficulty (adaptive.ts): on in a match, off in a training room unless asked for - Last Stand, Bad Blood
   *  and Rift War run in training rooms and ask; the Training Ground and Arcade survival do not. */
  adaptive?: boolean;
  stage?: StageId;
  collision?: CollisionWorld;
  trainingBot?: boolean;
  seed?: number;
  /** How many bodies the arena holds. A room is twelve; arcade survival
   *  fields a horde, and runs in the player's own browser. */
  capacity?: number;
  /** Whether training brings the fallen back. Arcade survival is a training
   *  room with no sparring bot where death is the end of the run. */
  respawn?: boolean;
  /** Every fighter's stamina bar in this room (100 unless set). Duel, Training,
   *  the royale and Bad Blood pass COMBO_STAMINA (moves.ts); Arcade survival and
   *  Last Stand keep their own. */
  maxStamina?: number;
  /** Every fighter's health bar in this room (MAX_HP unless set), at spawn and
   *  whenever they are stood back up whole. The same rooms pass COMBO_HP. */
  maxHp?: number;
  /** The share of their health bar a fighter gets back for each opponent they knock out. The royale passes KO_HEAL;
   *  everything else none. */
  koHeal?: number;
  resolveAreas?: boolean;
  lockCombat?: boolean;
}

interface AreaStrike {
  actorId: string; fighter: FighterId; move: MoveDefinition;
  /** The circle's centre, on the floor. */
  at: Vec3;
  /** When the first strike lands, when each lands after it (its look's strikes, areaDamage.ts), and which is next. */
  due: number; offsets: number[]; next: number;
  castId: number; opened: Map<string, number>;
}
/** One area strike's blow on a body (round 3): its share of the damage for where the body stood (areaFalloff), and
 *  whether that was the bullseye. */
interface AreaBlow { scale: number; bullseye: boolean }

/** Strict transport boundary: only finite, bounded controls enter the simulation. */
/** Which slots a landed move may cancel into. Cancelling on connect is what
 *  turns four attacks into a combo system rather than a queue of animations. */
const CANCEL_ROUTES: Record<AttackSlot, AttackSlot[]> = {
  area: [],
  light: ['light', 'heavy', 'special', 'ultimate'],
  // A landed heavy routes into normals as well. It used to route into nothing
  // a player could reach: measured across the roster, eight of the ten could
  // not follow a connected heavy with anything at all, so the only thing to
  // learn was to mash light. It is also the whole of why the air combat was
  // unreachable - the victim of a heavy is off their feet for about a second
  // and the attacker's next cast could not arrive inside that window.
  //
  // Nothing else has to move: a chained normal already waives its own
  // cooldown, and `cancellable` already demands the move connected and is past
  // its first contact, so only a heavy that actually landed routes anywhere.
  heavy: ['light', 'heavy', 'special', 'ultimate'],
  special: ['ultimate'],
  ultimate: [],
};
/** Only a special or an ultimate knocks a committed attacker out of their move.
 *  A light or heavy trades: it damages and builds meter, but the attack
 *  continues. Anything else makes every exchange a coin flip on who twitched
 *  first. */
/** What it takes to knock a committed fighter out of the move they are in.
 *  A light or a heavy never does; a special or an ultimate does - except
 *  against an ultimate, which only another ultimate can interrupt. */
const ARMOUR_BREAKING: AttackSlot[] = ['special', 'ultimate'];
function breaksArmour(incoming: AttackSlot, committed: AttackSlot): boolean {
  return committed === 'ultimate' ? incoming === 'ultimate' : ARMOUR_BREAKING.includes(incoming);
}
/** Melee with no authored lunge still steps into the strike, rather than
 *  swinging at the air from standstill. */
const DEFAULT_MELEE_LUNGE = 3.2;
/** Arcade poise: how much harder each slot breaks it than it hurts, how long
 *  a broken body reels, how long before it can be poised again once it is up,
 *  and how it comes back when left alone (a share of the whole per second,
 *  after a quiet spell). */
const POISE_SLOT: Record<AttackSlot, number> = { light: 1, heavy: 1.6, special: 2, ultimate: 3, area: 2 };
const POISE_BREAK_STUN = 2.6;
const POISE_GRACE = 1.2;
const POISE_REGEN_DELAY = 3;
const POISE_REGEN = .12;
/** Whether a move's lunge is driven only through the last stride before the blow: a move with no authored lunge, or
 *  a melee move of a body whose authored lunges are driven that way (BodyTraits.driveMelee, engine/sim/traits.ts). */
const drives = (fighter: FighterId, move: MoveDefinition) => move.lunge === undefined || (!!traitsOf(fighter).driveMelee && move.style === 'melee');
/** How long before its blow a drive runs: a charge-in drives late and fast. */
const driveWindowOf = (fighter: FighterId, move: MoveDefinition) => move.chargeIn && drives(fighter, move)
  ? Math.min(CHARGE_DRIVE, move.contacts[0] * .65, Math.max(move.contacts[0] - CHARGE_SLIDE, .1)) : Math.min(.35, move.contacts[0] * .65);
/** When a charge-in's slide back must be over: CHARGE_BACKSTEP_UNTIL into the
 *  cast, or when its approach starts driving in (an iai: when its dash
 *  starts), whichever is sooner - so the two never pull against each other. */
function backstepWindow(fighter: FighterId, move: MoveDefinition) {
  const drive = move.dashThrough ? move.contacts[0] - DASH_THROUGH_LEAD
    : drives(fighter, move) ? move.contacts[0] - driveWindowOf(fighter, move) : move.lungeDelay ?? 0;
  return clamp(drive, .1, CHARGE_BACKSTEP_UNTIL);
}
/** Everyone the sparring bot and a bot draft can be. */
// Less any fighter built but not yet released (economy/fighters.ts HELD): never drafted as a bot.
const ROSTER = (Object.keys(MOVES) as FighterId[]).filter(f => isReleasedFighter(f) && !HELD.has(f));
/** The peak speeds that make the two short dashes cover exactly their
 *  authored ground, computed once against the shape the forward dash uses. */
const BACKDASH_SPEED = dashPeakSpeed(BACKDASH_SECONDS, BACKDASH_TRAVEL);
const SIDESTEP_SPEED = dashPeakSpeed(SIDESTEP_SECONDS, SIDESTEP_TRAVEL);
/** The chase's peak speed per metre it has to cover, off the same tick-sampled
 *  shape, so it arrives where it was aimed rather than about there. */
const CHASE_UNIT = dashPeakSpeed(CHASE_SECONDS, 1);
/** How far ahead an air string's ride on its juggle is solved to put the
 *  thrower level with the body again: about the next stage's contact. */
const JUGGLE_RIDE_AHEAD = .25;
/** Grace after the last contact before the attacker may move or dash again.
 *  A light gets almost none of it: chained normals have to flow into one
 *  another, and a sixtieth of a second of lockout per jab is what the string
 *  feels like rather than what it looks like. */
const RECOVERY_GRACE = 0.06;
const LIGHT_RECOVERY_GRACE = 0.015;
/** How wide the melee auto-aim cone is, as a dot product: 55 degrees either
 *  side. Wide enough to forgive a mouse that is not exactly on them, narrow
 *  enough that a swing never turns round to find someone. */
const MELEE_AIM_COS = Math.cos(0.96);
/** The cone for the fighter the player chose (the lock, or the auto target the
 *  client sends). The lock-on camera frames the pair off-axis - the opponent
 *  sits 20-60 degrees off the view it is steered from - and a chosen target
 *  outside the plain 55-degree cone turned every swing into a whiff. Still
 *  bounded by the move's own reach, so it homes rather than magnetises. */
const CHOSEN_AIM_COS = Math.cos(1.4);
/** Round 3b (TARGET): the crowd rule's cone. Unless the player holds a Tab
 *  lock, an attack goes to the nearest enemy inside this half-angle of the way
 *  it was aimed or of the way the body faced (chooseIntent): sixty degrees
 *  either side, which takes in the lock-on camera's framing of the fighter it
 *  is on (46 to 57 degrees right of centre up close) but nobody standing off
 *  the player's shoulder. */
const INTENT_COS = Math.cos(Math.PI / 3);
/** How much further off, in metres per unit of (1 - cos), a candidate at the
 *  edge of that cone counts than one dead ahead: two at about the same
 *  distance resolve to the one in front. 0.28 m at the cone's edge. */
const INTENT_TURN = .55;
/** Round 3d (PACE): a cast's age is compared with authored times this much
 *  short, so a time that is a whole number of ticks is reached on the tick
 *  after it, every time. The age is a difference of two clocks summed tick by
 *  tick, and a rollback replays a cast from the snapshot's clock rather than
 *  its own: on a blow at a whole tick (0.15 s is nine) the live copy and the
 *  replay came down on different sides of it, landed it a tick apart, and
 *  corrected the fighter 2-3.5 cm (Taisei, Shirokane, Gummy and Setsu, whose
 *  lights land at 0.15; Setsu's used to at 0.2). The tick after is where
 *  the live copy mostly put it, and what the hit presentation is tuned to.
 *  Not the ultimates: they are the ULTS stream's, timed as they were. */
const AGE_EPSILON = 1e-6;
/** Round 3c (LOCK): how far in front of its thrower, along the line it
 *  travels, a body must stand to be in a blow's path at all (see inLane). A
 *  shot, a beam or a swing leaves the hands, and a body level with the
 *  thrower's shoulder or behind them is not in front of it however wide its
 *  volume is - the second critic's crowd had the sparring bot 1.1 m off
 *  Kagari's side, and a Taimatsu fired at the lock 2.5 m ahead burst on the bot as
 *  it left the hand. At touching distance this is 66 degrees either side of
 *  the line; further out the volume's own width decides, as it did. */
const LANE_FRONT = PLAYER_RADIUS;
/** Round 4b (FMOVES): a shot aimed as it is let go (MoveDefinition.aimOnRelease). Through its wind-up its thrower
 *  turns after the body it is thrown at at up to SHOT_TRACK radians a second; it leaves at where that body will be when
 *  it arrives - its run along the floor carried over the flight, SHOT_LEAD metres at most - and never further than
 *  SHOT_CONE radians off the way the thrower faces: a body that has gone round behind him is not shot over his
 *  shoulder. */
const SHOT_TRACK = 6, SHOT_LEAD = 3.5, SHOT_CONE = .9;
/** Round 3d (ULTS): a hit-confirm ultimate's hold and its shield run this far
 *  past the finisher's due time, so the tick the finisher lands on is inside
 *  them whatever an impact freeze has done to the cast's clock. */
const CINEMATIC_MARGIN = .05;
/** Round 3d (ULTS): how long somebody is left dazed when a cinematic lets go
 *  of them without its finisher - its thrower defeated, the room reset. */
const LET_GO_STUN = .3;
/** Round 3e (ULTFIX): contact `contact` of `move` as its damage schedule has
 *  it (MoveDefinition.schedule) - the same move landing that contact's own
 *  base damage, as a blow or as the finisher - built once per move and
 *  contact, so a barrage allocates nothing as it lands. A move with no
 *  schedule is itself. */
const SCHEDULED = new WeakMap<MoveDefinition, MoveDefinition[]>();
function scheduled(move: MoveDefinition, contact: number): MoveDefinition {
  const damage = move.schedule?.[contact];
  if (damage === undefined) return move;
  let each = SCHEDULED.get(move);
  if (!each) { each = []; SCHEDULED.set(move, each); }
  return each[contact] ??= { ...move, damage, finisherDamage: damage };
}

export function validateInput(raw: unknown): PlayerInput | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const i = raw as Record<string, unknown>;
  if (!Number.isSafeInteger(i.seq) || (i.seq as number) < 0) return null;
  for (const k of ['moveX', 'moveZ', 'yaw']) if (typeof i[k] !== 'number' || !Number.isFinite(i[k])) return null;
  if (Math.abs(i.moveX as number) > 1 || Math.abs(i.moveZ as number) > 1 || Math.abs(i.yaw as number) > 1e6) return null;
  for (const k of ['jump', 'jumpHeld', 'dash', 'guard', 'awaken', 'lock']) if (i[k] !== undefined && typeof i[k] !== 'boolean') return null;
  if (i.attack !== undefined && !slots.includes(i.attack as AttackSlot)) return null;
  if (i.targetId !== undefined && i.targetId !== null && (typeof i.targetId !== 'string' || i.targetId.length > 128)) return null;
  if (i.view !== undefined && (typeof i.view !== 'number' || !Number.isFinite(i.view) || i.view < 0)) return null;
  if (i.dir !== undefined && i.dir !== 'n' && i.dir !== 'f' && i.dir !== 'b' && i.dir !== 's') return null;
  const aim = i.aim as { x?: unknown; z?: unknown } | undefined;
  if (aim !== undefined && (!aim || typeof aim !== 'object' || typeof aim.x !== 'number' || typeof aim.z !== 'number'
    || !Number.isFinite(aim.x) || !Number.isFinite(aim.z) || Math.abs(aim.x) > 1e4 || Math.abs(aim.z) > 1e4)) return null;
  return { seq: i.seq as number, moveX: i.moveX as number, moveZ: i.moveZ as number,
    yaw: (((i.yaw as number) + Math.PI) % TAU + TAU) % TAU - Math.PI,
    jump: i.jump as boolean | undefined, jumpHeld: i.jumpHeld as boolean | undefined, dash: i.dash as boolean | undefined,
    guard: i.guard as boolean | undefined, awaken: i.awaken as boolean | undefined,
    attack: i.attack as AttackSlot | undefined,
    targetId: i.targetId as string | null | undefined, lock: i.lock as boolean | undefined,
    ...(i.view !== undefined ? { view: i.view as number } : {}), ...(aim ? { aim: { x: aim.x as number, z: aim.z as number } } : {}),
    ...(i.dir !== undefined ? { dir: i.dir as StickDir } : {}) };
}

/** Round 3e (VARIETY): what a bot remembers between thoughts. Whom it is
 *  after, the route there (NavGrid cells) and whom and where it was planned
 *  for, the closest it has come to them since it chose them and when (a bot
 *  that has not got closer in BOT_GIVE_UP_AFTER gives them up), where it was
 *  and since when it has not moved (to jump or re-route out of a snag), and
 *  whom it has given up on until when. */
interface BotMind {
  targetId?: string;
  /** Routes by where they lead ('ring' for the middle, else a body's id). */
  routes: Map<string, { cells: number[] | null; x: number; z: number; at: number }>;
  best: number; bestAt: number;
  stillX: number; stillZ: number; stillSince: number;
  given: Map<string, number>;
}
/** Seconds a bot will chase somebody without getting any closer before it
 *  gives them up, and how long it leaves them alone for. */
const BOT_GIVE_UP_AFTER = 4, BOT_GIVE_UP_FOR = 7;
/** Seconds between a bot's route plans to the same body. */
const BOT_REPLAN = 1.2;
const HUNT_QUIET = 12;
/** Quiet this long, a fighter is gone after by the nearest bot whether or
 *  not it is in a fight of its own: a bot duel runs forty seconds, and a
 *  player standing off beside one waited for it to end. Still one bot. */
const HUNT_ANYWAY = 24;
/** A bot is in a fight of its own - not sent hunting - while it has landed
 *  or taken a blow within BOT_BUSY seconds, or the body it is after is
 *  within BOT_BUSY_NEAR metres. */
const BOT_BUSY = 3, BOT_BUSY_NEAR = 8;
/** Choosing whom to fight, a body other bots are already after counts as
 *  this many metres further off for each of them (botCrowd) - unless it is
 *  within BOT_TAKE_ON, where it is fought whoever else is. */
const BOT_SPREAD = 8, BOT_TAKE_ON = 6;

/** Renderer-independent authoritative state. Same inputs + seed + step sequence replay identically. */
export class ArenaSimulation {
  readonly actors = new Map<string, Actor>();
  readonly roomMode: RoomMode;
  serverTime = 0;
  tick = 0;
  status: GameSnapshot['status'];
  winnerId: string | null = null;
  private events: CombatEvent[] = [];
  readonly trainingLab = new TrainingLab();
  /** Adaptive difficulty (adaptive.ts, 28 October 2026): each human's skill in this match, and every bot's strength.
   *  Off in Training; with no human in the field every bot stays at today's strength. */
  readonly adaptive: AdaptiveDirector;
  trainingBotMode: 'passive'|'combat'='combat';
  /** Couch Training (seatPair): the two people seated face to face in a Training with no dummy, Player 1's first. */
  pair?: readonly [string, string];
  /** Round 3e (VARIETY): each bot's memory between thoughts (BotMind). The
   *  server's alone: a client never thinks for a bot. */
  private readonly minds = new Map<string, BotMind>();
  private eventId = 0;
  private randomState: number;
  private projectiles: Projectile[] = [];
  private areas: AreaStrike[] = [];
  private readonly resolveAreas: boolean;
  /** Lock combat (lockCombat.ts): asked for by this simulation. */
  /** Lock combat (lockCombat.ts): whether this simulation plays it. The page's prediction copy asks the same of its own. */
  readonly lockCombat: boolean;
  private startedAt = 0;
  /** Round 4 (STAGES): the bot hunting each quiet fighter, by the fighter's
   *  id (botHunt), and when each fighter's damage dealt last moved, as the
   *  bots have seen it (engagedAt). The server's alone, like the minds. */
  private readonly hunts = new Map<string, { by: string; since: number; anyway?: boolean }>();
  private readonly dealt = new Map<string, { total: number; at: number }>();
  private collision?: CollisionWorld;
  stage: StageId;
  private readonly capacity: number;
  private readonly respawns: boolean;
  /** The room's stamina bar (SimulationOptions.maxStamina). */
  readonly staminaMax: number;
  /** The room's health bar (SimulationOptions.maxHp). */
  readonly hpMax: number;
  /** The royale's heal for a knockout (SimulationOptions.koHeal, KO_HEAL): a share of the scorer's bar. */
  readonly koHeal: number;
  rewind = 0;
  /** Where each fighter stood over the last `rewind` seconds, oldest first (lag compensation). */
  private readonly trail = new Map<string, { t: number; x: number; y: number; z: number }[]>();
  /** Arcade survival's horde and its hack-and-slash aim (see ExternalTargets
   *  and AimAssist). Unset in every other room. */
  external?: ExternalTargets;
  assist?: AimAssist;
  private readonly nearby: ExternalBody[] = [];

  constructor(options: SimulationOptions = {}) {
    this.roomMode = options.roomMode ?? 'training';
    this.adaptive = new AdaptiveDirector(options.adaptive ?? this.roomMode !== 'training');
    this.status = this.roomMode === 'training' ? 'active' : 'waiting';
    this.stage = options.stage ?? 'harbor';
    this.collision = options.collision;
    this.capacity = options.capacity ?? MAX_PLAYERS;
    this.respawns = options.respawn ?? true;
    this.staminaMax = options.maxStamina ?? 100;
    this.hpMax = options.maxHp ?? MAX_HP;
    this.koHeal = options.koHeal ?? 0;
    this.resolveAreas = options.resolveAreas ?? true;
    this.lockCombat = !!options.lockCombat;
    // Unseeded, the stream is drawn from the clock: a fixed default meant
    // every training room drafted the same sparring partner and every match
    // seated the same rival opposite. A test that needs the replay passes a
    // seed. Xorshift is stuck at zero, so the state is never zero.
    this.randomState = options.seed ?? (((Math.random() * 0x7fffffff) | 0) || 1);
    if (this.roomMode === 'training' && options.trainingBot !== false) {
      // Whoever the bot is here is provisional: the human's own pick is not
      // known until they join, and addPlayer redraws it against that.
      this.addPlayer('sparring-bot', this.pick(ROSTER), 'Sparring bot', true, clearSpot(this.stage, { x: 0, y: 0, z: -trainingReach(this.stage) * .55 }));
    }
  }

  /** One of `items`, off the seeded stream. */
  pick<T>(items: readonly T[]): T { return items[Math.min(items.length - 1, Math.floor(this.random() * items.length))]; }

  /** A copy of `items` in a random order, off the seeded stream, so a room
   *  that wants a shuffled draft or a shuffled seating shares the replay. */
  shuffle<T>(items: readonly T[]): T[] {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  /** Play bounds are the stage's, not one global arena square: a tournament
   *  ring is 30 m across and the harbour is 160 m. */
  get bounds() { return STAGES[this.stage]; }

  /** Swap arena. The collision world goes with it, because it is the stage:
   *  keeping the harbour's colliders would leave invisible buildings standing
   *  in the middle of Wreckers' Causeway. */
  setStage(stage: StageId, collision?: CollisionWorld) {
    if (stage === this.stage && !collision) return;
    this.stage = stage;
    if (collision) {
      this.collision?.dispose?.();
      this.collision = collision;
    }
    for (const actor of this.actors.values()) this.collision?.remove?.(actor.state.id);
  }

  private random() {
    this.randomState ^= this.randomState << 13;
    this.randomState ^= this.randomState >>> 17;
    this.randomState ^= this.randomState << 5;
    return (this.randomState >>> 0) / 4294967296;
  }

  addPlayer(id: string, fighter: FighterId = 'taisei', name = 'Fighter', isBot = false, spawn?: Vec3): PlayerState {
    if (this.actors.has(id)) throw new Error('Player already exists');
    if (this.actors.size >= this.capacity) throw new Error('Arena is full');
    if (this.roomMode === 'match' && this.status !== 'waiting') throw new Error('Match already started');
    // Spawn sectors are per seat, not per human: a royale's bots need their
    // own corner of the stage or the whole field starts inside one another.
    const index = [...this.actors.values()].filter(a => this.roomMode === 'match' || !a.state.isBot).length;
    const angle = index / MAX_PLAYERS * TAU;
    const origin = spawn ?? (this.roomMode === 'training'
      ? trainingSpawn(index, this.stage)
      : safeSpawn(index, this.stage));
    const state: PlayerState = {
      id, name: tidyName(name, 20),
      fighter: fighter in MOVES ? fighter : 'taisei', ...position(origin), yaw: isBot ? 0 : Math.PI,
      hp: this.hpMax, maxHp: this.hpMax, stamina: this.staminaMax, maxStamina: this.staminaMax, ultimate: 0, awakening: 0, action: 'idle',
      actionStarted: this.serverTime, actionDuration: 0, actionTime: 0,
      target: this.roomMode === 'training' && !isBot && this.actors.has('sparring-bot') ? 'sparring-bot' : null,
      alive: true, isBot, grounded: origin.y <= 0.01, guarding: false,
      kills: 0, damageDealt: 0, damageTaken: 0,
      cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0, area: 0 },
    };
    // A body drawn bigger than the roster's is hit and pushed where it is drawn (BODY_SIZE).
    if (BODY_SIZE[state.fighter]) state.size = BODY_SIZE[state.fighter];
    // The sparring partner is drawn against the human's pick, now that it is
    // known: never a mirror match, and not the same fighter every session.
    // The first opponent anyone met used to be Konta, without exception.
    const sparring = this.roomMode === 'training' && !isBot ? this.actors.get('sparring-bot') : undefined;
    if (sparring && ![...this.actors.values()].some(a => !a.state.isBot)) {
      sparring.state.fighter = this.pick(ROSTER.filter(f => f !== state.fighter));
      sparring.state.size = BODY_SIZE[sparring.state.fighter];
    }
    this.actors.set(id, { state, input: { seq: -1, moveX: 0, moveZ: 0, yaw: state.yaw }, lastSeq: -1,
      lastInputAt: this.serverTime, vy: 0, kx: 0, kz: 0, knockbackDrag: 7, reaction: null,
      hitstopFrom: 0, hitstopUntil: 0, comboUntil: 0, stunUntil: 0, freezeUntil:0, evadeUntil: 0, reactionClip: .3,
      dashUntil: 0, dashX: 0, dashY: 0, dashZ: 0, dashSpeed: 24, dashEntry: 0, dashPlateau: 1, juggleHits: 0,
      dashSeconds: DASH_SECONDS, dashKind: 'forward', jumping: false,
      jumpAt: -Infinity, jumpStartedAt: -Infinity, dashAt: -Infinity, attackAt: -Infinity, attackHold: -Infinity, attackNotified: -Infinity,
      groundedAt: -Infinity, leapt: false, landedUntil: -Infinity, // Round 4b (JUMP)
      boosting: false, airJumps: 0, // The ball rooms (AimAssist.sport)
      awakenAt: -Infinity, awakenEntryUntil: 0,
      cast: null, respawnAt: 0, nextBotThink: 0,
      lastDamageAt: -10, chainHits: 0, scalingHits: 0, spawn: position(origin),
      guardAt: -Infinity, wasGuarding: false, guardHeld: false, guardPressedAt: -Infinity,
      guardReleasedAt: -Infinity, parryCaught: false, parryLockUntil: -Infinity, counterUntil: -Infinity, parriedUntil: -Infinity,
      bounceOnLand: false, launchLead: 0, launchSpan: 0, launchRun: 0, botSkill: this.random(),
      mx: 0, mz: 0, blockedUntil: -Infinity, castSerial: 0, rushStage: 0, rushUntil: -Infinity, rushOpened: [],
      chaseUntil: -Infinity, lightChaseUntil: -Infinity, dashChase: false, vanishedAt: -Infinity, intent: null, intentCast: -1, faceYaw: state.yaw,
      // Round 4b (COMBAT): every field the rollback checkpoint carries is set from the start - a key the server's copy
      // never had is left as the client last guessed it when the checkpoint is put back.
      ...pressClock() });
    return { ...state, cooldowns: { ...state.cooldowns } };
  }

  /** An arcade enemy or boss: a body that is not one of the roster, on a side,
   *  with its own moves and its own brain (driven through `command`). It is
   *  otherwise an actor like any other - the same movement, the same hit
   *  reactions, launches, juggles and wall splats - which is the point: every
   *  fighter's whole kit works on a horde without a line of it knowing. */
  addCombatant(id: string, spec: CombatantSpec): PlayerState {
    this.addPlayer(id, spec.fighter ?? 'kagari', spec.name ?? 'Enemy', true, spec.spawn);
    const a = this.actors.get(id)!;
    // Copied: a boss swaps moves in and out of its slots (setMove), and a
    // horde of one kind shares a single definition.
    a.kit = { ...spec.kit }; a.external = true;
    a.poise = a.poiseMax = spec.poise ?? 0;
    a.breaker = spec.breaker ?? true;
    a.armour = spec.armour ?? true;
    a.anchored = spec.anchored;
    a.mods = { ...NEUTRAL_MODS, ...spec.mods };
    Object.assign(a.state, { team: spec.team, enemy: spec.enemy, hp: spec.maxHp, maxHp: spec.maxHp,
      yaw: spec.yaw ?? a.state.yaw, size: spec.size && spec.size !== 1 ? spec.size : undefined, poise: a.poiseMax > 0 ? 1 : undefined, girth: spec.girth });
    a.input.yaw = a.state.yaw;
    return { ...a.state, cooldowns: { ...a.state.cooldowns } };
  }

  /** A command from outside the simulation - an enemy's brain - stamped with
   *  the actor's next input sequence, as the bot brain does for itself. */
  command(id: string, input: Omit<PlayerInput, 'seq'>): boolean {
    const a = this.actors.get(id);
    return !!a && this.submitInput(id, { ...input, seq: a.lastSeq + 1 });
  }

  /** Put one of a boss's moves in a slot before pressing it. A running cast
   *  keeps the definition it started with. */
  setMove(id: string, slot: AttackSlot, move: MoveDefinition) {
    const a = this.actors.get(id);
    if (a?.kit) a.kit[slot] = move;
  }

  /** Arcade upgrades and enemy tiers. Merged onto what the actor has. */
  /** A human's skill as their page knows it (adaptive.ts; unknown or nonsense: the start). */
  setPlayerSkill(id: string, skill: unknown) { this.adaptive.join(id, skill); }
  /** A bot held at one strength whatever the field (scripts/engine/bot_strength.mts, the tests). */
  setBotStrength(id: string, strength: number) { this.adaptive.fix(id, strength); }
  /** A custom room's or a party's difficulty: a step from the adaptive aim (adaptive.ts DIFFICULTY_STEP). */
  setDifficulty(difficulty: Difficulty | undefined) { this.adaptive.setDifficulty(difficulty); }
  setMods(id: string, mods: Partial<CombatMods>) {
    const a = this.actors.get(id);
    if (a) a.mods = { ...NEUTRAL_MODS, ...a.mods, ...mods };
  }
  mods(id: string): Readonly<CombatMods> { return this.actors.get(id)?.mods ?? NEUTRAL_MODS; }

  /** Put someone on a side. */
  setTeam(id: string, team: string | undefined) {
    const a = this.actors.get(id);
    if (a) a.state.team = team;
  }

  /** A blow nobody swung: an upgrade's shockwave, a chain of lightning, a
   *  hazard. It lands through the same rules as any other - guard, dodge,
   *  reactions, meters - and credits `attackerId` with it. */
  strike(attackerId: string, targetId: string, slot: AttackSlot, move: MoveDefinition, origin?: Vec3, minor = false, crowd = false) {
    const attacker = this.actors.get(attackerId), target = this.actors.get(targetId);
    if (!target || !target.state.alive || this.status !== 'active') return;
    if (attacker && !this.hostile(attacker.state, target.state)) return;
    const from = origin ?? (attacker ? centre(attacker.state) : centreOf(target.state));
    this.hit(attackerId, target, slot, move, from, true, from, undefined, undefined, undefined, 0, undefined, minor, crowd);
  }

  /** The same, landing on a horde body (an upgrade's shockwave or chain
   *  through the crowd): everything a blow does to its thrower, and the rest
   *  handed to the horde. False when it could not land. */
  strikeExternal(attackerId: string, id: string, slot: AttackSlot, move: MoveDefinition, origin?: Vec3) {
    const body = this.external?.locate(id);
    if (!body || this.status !== 'active') return false;
    const attacker = this.actors.get(attackerId);
    return this.hitExternal(attackerId, body, slot, move, origin ?? (attacker ? centre(attacker.state) : { x: body.x, y: body.y + body.height * .55, z: body.z }), true);
  }

  /** Health back, never past the maximum. */
  heal(id: string, amount: number) {
    const p = this.actors.get(id)?.state;
    if (p?.alive && amount > 0) p.hp = Math.min(p.maxHp, p.hp + amount);
  }

  /** Raise or lower a body's maximum health, keeping the share it has. */
  setMaxHp(id: string, maxHp: number, heal = 0) {
    const p = this.actors.get(id)?.state;
    if (!p || !(maxHp > 0)) return;
    const share = p.hp / p.maxHp;
    p.maxHp = maxHp; p.hp = Math.min(maxHp, Math.max(1, share * maxHp) + heal);
  }

  /** Fill the two meters, for arcade pickups. */
  addMeter(id: string, ultimate: number, awakening = 0) {
    const p = this.actors.get(id)?.state;
    if (!p) return;
    p.ultimate = Math.min(100, p.ultimate + ultimate);
    p.awakening = Math.min(100, (p.awakening ?? 0) + awakening);
  }

  /** Health off with nothing behind it - a burn, a horde routed by its boss's
   *  fall: no reaction, no freeze, no meters, only the number and, at zero,
   *  the fall. Credited to `sourceId`. */
  damage(targetId: string, amount: number, sourceId: string, move: string) {
    const target = this.actors.get(targetId);
    if (!target?.state.alive || this.status !== 'active' || !(amount > 0)) return;
    const p = target.state, before = p.hp;
    p.hp = Math.max(0, p.hp - amount * (target.mods ? target.mods.damageIn : 1) * this.adaptive.factor(this.actors.has(sourceId) ? sourceId : undefined, targetId));
    this.tally(target, this.actors.get(sourceId), before - p.hp);
    this.emit({ kind: 'hit', actorId: sourceId, targetId, move, damage: Math.round(before - p.hp), origin: centreOf(p), endpoint: centreOf(p) });
    if (p.hp === 0) this.eliminate(target, sourceId);
  }

  /** Back on their feet where they fell, with `hp` and a moment's protection,
   *  keeping both meters. For arcade survival's revive. */
  revive(id: string, hp: number) {
    const a = this.actors.get(id);
    if (!a || a.state.alive) return;
    const at = position(a.state), yaw = a.state.yaw, ultimate = a.state.ultimate, awakening = a.state.awakening;
    this.respawn(a);
    Object.assign(a.state, at, { yaw, ultimate, awakening, hp: Math.min(a.state.maxHp, Math.max(1, hp)) });
    a.evadeUntil = this.serverTime + 2;
  }

  /** Put a body somewhere, standing, as a stage change needs. */
  place(id: string, at: Vec3, yaw = 0) {
    const a = this.actors.get(id);
    if (!a) return;
    Object.assign(a.state, position(at), { yaw, grounded: true });
    a.vy = a.kx = a.kz = a.mx = a.mz = 0; a.spawn = position(at);
    a.input = { ...a.input, yaw, moveX: 0, moveZ: 0 };
    this.collision?.remove?.(id);
  }

  /** Every body's public state, without the rollback and reaction records a
   *  networked snapshot carries: what a game run in the browser draws from. */
  playerStates(): PlayerState[] {
    return [...this.actors.values()].map(a => ({ ...a.state, ackSeq: a.lastSeq, hitstopFrom: a.hitstopFrom, hitstopUntil: a.hitstopUntil, cooldowns: { ...a.state.cooldowns } }));
  }

  /** The events since the last drain, handed over and cleared. */
  drainEvents(): CombatEvent[] { const out = this.events; this.events = []; return out; }

  /** Whether a blow from `a` may land on `b`: two different bodies, and not
   *  on one side. Without a side that is every other body, as it always was. */
  private hostile(a: PlayerState, b: PlayerState) {
    return a.id !== b.id && (a.team === undefined || a.team !== b.team);
  }

  seatPair(first: string, second: string) {
    const a = this.actors.get(first), b = this.actors.get(second);
    if (this.roomMode !== 'training' || !a || !b || a === b) return false;
    const turn = STAGES[this.stage].duelAxis ?? 0, one = safeSpawn(0, this.stage, [], turn), two = safeSpawn(MAX_PLAYERS / 2, this.stage, [one], turn);
    this.place(first, one); this.place(second, two);
    this.pair = [first, second];
    this.faceOff(a); this.faceOff(b);
    return true;
  }

  /** Launch day (12 October 2026): turn a fighter to the closest opponent standing (`hostile`: anyone alive who is not
   *  on their side) - the body, the heading the input it holds carries, and the facing a press reads (`faceYaw`). For
   *  the start of a match or a round, where nobody has yet said which way they look; with nobody to face they are left
   *  as they are. Two opponents exactly as near (the neighbours either side on a royale's ring) go to whichever joined
   *  the room first, which is as much of a choice as anyone has made. */
  private faceOff(a: Actor) {
    const p = a.state;
    let nearest = Infinity, yaw = p.yaw;
    for (const other of this.actors.values()) {
      const q = other.state;
      if (!q.alive || !this.hostile(p, q)) continue;
      const dx = q.x - p.x, dz = q.z - p.z, gap = dx * dx + dz * dz;
      if (gap < nearest && gap > 1e-8) { nearest = gap; yaw = Math.atan2(dx, dz); }
    }
    p.yaw = a.faceYaw = a.input.yaw = yaw;
  }

  /** The move a cast in `slot` throws: the kit's, for a body that is not one
   *  of the roster, else the fighter's own (the rush stage for a light). */
  private moveOf(a: Actor, slot: AttackSlot, stage = 0): MoveDefinition {
    // A kit body (an arcade enemy) has no area move: its special stands in, though nothing of it ever presses the area.
    if (a.kit) return a.kit[slot] ?? a.kit.special;
    if (a.forged && (slot !== 'light' || stage === 0)) return this.forgedMove(a, slot);
    return slot === 'light' ? rushMove(a.state.fighter, stage, !!a.state.awakened) : moveFor(a.state.fighter, slot, !!a.state.awakened);
  }
  /** A forged fighter's move in `slot`, awakened as moveFor awakens a roster fighter's (AWAKENED_MOVES over it). */
  private forgedMove(a: Actor, slot: AttackSlot): MoveDefinition {
    const base = a.forged![slot], change = a.state.awakened ? AWAKENED_MOVES[a.state.fighter]?.[slot] : undefined;
    return change ? { ...base, ...change } : base;
  }
  forge(id: string, moves?: Record<AttackSlot, MoveDefinition>, hash?: string): boolean {
    const actor = this.actors.get(id);
    if (!actor || actor.kit || actor.state.isBot) return false;
    if (moves && hash) { actor.forged = moves; actor.state.forge = hash; }
    else { delete actor.forged; delete actor.state.forge; }
    return true;
  }
  /** Melee reach and the striking gap. A roster fighter's are measured off
   *  its rig (moves.ts); a kit body's are its move's own numbers. */
  /** Lag compensation: each fighter's place this tick, kept for `rewind` seconds and a little over. */
  private record() {
    const keep = this.serverTime - this.rewind - .1;
    for (const a of this.actors.values()) {
      const id = a.state.id, trail = this.trail.get(id) ?? [];
      trail.push({ t: this.serverTime, x: a.state.x, y: a.state.y, z: a.state.z });
      let old = 0; while (old < trail.length - 2 && trail[old + 1].t <= keep) old++;
      if (old) trail.splice(0, old);
      this.trail.set(id, trail);
    }
    for (const id of this.trail.keys()) if (!this.actors.has(id)) this.trail.delete(id);
  }

  /** `target` where `a` saw it (lag compensation, `rewind`): its place `a.viewLag` seconds ago, between the two
   *  recorded ticks either side - or as it stands, with the rewind off, nothing recorded, or a jump of more than ten
   *  metres between them (a respawn, a teleport, which is never a place it moved through). Everything else about it
   *  (its guard, its dodge, its health) is as it is now: the hit is applied to the fighter, only where it is is seen. */
  private seenBy(a: Actor, target: PlayerState): PlayerState {
    const lag = this.rewind > 0 && a.viewLag ? a.viewLag : 0;
    if (lag <= 0 || target === a.state) return target;
    const trail = this.trail.get(target.id);
    if (!trail?.length) return target;
    const t = this.serverTime - lag;
    let i = trail.length - 1;
    while (i > 0 && trail[i].t > t) i--;
    const from = trail[i], to = trail[i + 1] ?? { t: this.serverTime, x: target.x, y: target.y, z: target.z };
    if (Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z) > 10) return target;
    const w = to.t > from.t ? clamp((t - from.t) / (to.t - from.t), 0, 1) : 1;
    return { ...target, x: from.x + (to.x - from.x) * w, y: from.y + (to.y - from.y) * w, z: from.z + (to.z - from.z) * w };
  }

  private reachOf(a: Actor, slot: AttackSlot, move: MoveDefinition, grounded = true) {
    if (!a.kit) return meleeReach(a.state.fighter, slot, move, grounded);
    return move.style === 'melee' ? move.range + PLAYER_RADIUS : Infinity;
  }
  /** The dream loop's feel pass (v69, moves.ts STRING_SHOVE): whether the thrower of a string's blow can follow the body
   *  it shoves - no third body in the lane its next stage's approach would drive along (as the approach holds it: a body
   *  ahead within its contact gap of the line stops it), out to where the shove leaves the struck one. With a bystander
   *  beside the path the approach stops short of it, and a body shoved out of the blow's reach was the string dropped
   *  (tests/phantomHits, Kosho's rush): there the blow pushes as it always did. */
  private roomToFollow(a: Actor, target: Actor, slot: AttackSlot, move: MoveDefinition) {
    const p = a.state, q = target.state, dx = q.x - p.x, dz = q.z - p.z, apart = Math.hypot(dx, dz);
    if (apart < 1e-3) return true;
    const ux = dx / apart, uz = dz / apart, gap = this.gapOf(a, slot, move, p.grounded), reach = apart + STRING_SHOVE;
    for (const other of this.actors.values()) {
      if (other === a || other === target || !other.state.alive || Math.abs(other.state.y - p.y) >= 1.5) continue;
      const ox = other.state.x - p.x, oz = other.state.z - p.z, along = ox * ux + oz * uz, across = ox * uz - oz * ux;
      if (along > LANE_FRONT && along < reach && Math.abs(across) < gap) return false;
    }
    return true;
  }

  /** Lock combat: whether a string's shove (STRING_SHOVE) has room behind the body - no wall, no edge of the floor. Into
   *  a wall it splats them mid-string (WALL_SPLAT_SPEED): a finisher's crash on a jab, which the blind critic saw on the
   *  training hall's rock ("a ring ~85% of the frame, a dust plume, debris and cracks, bigger than the finisher's"). */
  private shoveFits(target: Actor, ux: number, uz: number) {
    const q = target.state, length = STRING_SHOVE + PLAYER_RADIUS, { halfX, halfZ } = this.bounds;
    if (Math.abs(q.x + ux * length) > halfX - PLAYER_RADIUS || Math.abs(q.z + uz * length) > halfZ - PLAYER_RADIUS) return false;
    const wanted = { x: ux * length, y: 0, z: uz * length };
    const moved = this.collision?.move(q.id, { x: q.x, y: q.y, z: q.z }, wanted) ?? wanted;
    return Math.hypot(moved.x, moved.z) >= length * .9;
  }

  /** How far, up to `length`, the body can travel along (ux, uz) before the floor's edge or a wall stops it. */
  private roomBehind(target: Actor, ux: number, uz: number, length: number) {
    const q = target.state, { halfX, halfZ } = this.bounds;
    const edge = (at: number, u: number, half: number) => Math.abs(u) < 1e-6 ? Infinity : Math.max(0, ((u > 0 ? half : -half) - PLAYER_RADIUS * Math.sign(u) - at) / u);
    const open = Math.min(length, edge(q.x, ux, halfX), edge(q.z, uz, halfZ));
    if (open <= 0) return 0;
    const wanted = { x: ux * open, y: 0, z: uz * open };
    const moved = this.collision?.move(q.id, { x: q.x, y: q.y, z: q.z }, wanted) ?? wanted;
    return Math.hypot(moved.x, moved.z);
  }

  /** Lock combat: a string's blow never drives the body into a wall or off the floor's edge (the critic, round 4: in the
   *  training hall the finisher crashed Ouga into the rock, the chase's juggle crashed him again - "debris, black crack
   *  zigzags" each time - and the next string was pinned there). The finisher's throw is turned off it, up to
   *  LOCK_THROW_TURN either way, toward whichever line has the most of LOCK_THROW_ROOM (a body already at the wall goes
   *  off along it); every other blow slides only as far as the room behind, stopping short. */
  private lockClear(target: Actor, finisher: boolean) {
    const speed = Math.hypot(target.kx, target.kz);
    if (speed < 1e-3) return;
    const ux = target.kx / speed, uz = target.kz / speed, drag = target.knockbackDrag;
    if (!finisher) {
      const travel = drag > 0 ? speed / drag : Infinity, room = this.roomBehind(target, ux, uz, travel + LOCK_WALL_MARGIN);
      if (room >= travel + LOCK_WALL_MARGIN * .95 || !(drag > 0)) return;
      const allowed = Math.max(0, room - LOCK_WALL_MARGIN) * drag;
      target.kx = ux * allowed; target.kz = uz * allowed;
      return;
    }
    let best = 0, room = -1;
    for (const turn of [0, LOCK_THROW_TURN / 2, -LOCK_THROW_TURN / 2, LOCK_THROW_TURN, -LOCK_THROW_TURN]) {
      const c = Math.cos(turn), s = Math.sin(turn), got = this.roomBehind(target, ux * c - uz * s, ux * s + uz * c, LOCK_THROW_ROOM);
      if (got > room + .1) { best = turn; room = got; }
      if (got >= LOCK_THROW_ROOM * .95) break;
    }
    const c = Math.cos(best), s = Math.sin(best), vx = ux * c - uz * s, vz = ux * s + uz * c;
    // Short of room every way it may go: thrown as far as there is, stopping short, as any other blow.
    const travel = drag > 0 ? speed / drag : Infinity, keep = room >= Math.min(travel, LOCK_THROW_ROOM) || !(drag > 0) ? speed : Math.max(0, room - LOCK_WALL_MARGIN) * drag;
    target.kx = vx * keep; target.kz = vz * keep;
  }

  /** Lock combat: a finisher that launches knocks the body away instead - rising no faster than LOCK_THROW_RISE and
   *  sliding at least LOCK_THROW_FAR along the blow (the critic, round 5: a knockaway should send the target "4+
   *  body widths" into the room; ours popped Ouga 2.3 m up and 2 m off, or straight up, "stacked on Taisei's head"). */
  private lockKnockaway(target: Actor, ux: number, uz: number) {
    if (target.vy > LOCK_THROW_RISE) { target.vy = LOCK_THROW_RISE; target.launchLead = 0; }
    const speed = Math.hypot(target.kx, target.kz), want = LOCK_THROW_FAR * target.knockbackDrag;
    if (!(want > speed)) return;
    // Along the way it is already going, or the blow's where it barely moves.
    const dx = speed > .5 ? target.kx / speed : ux, dz = speed > .5 ? target.kz / speed : uz;
    target.kx = dx * want; target.kz = dz * want;
  }


  private gapOf(a: Actor, slot: AttackSlot, move: MoveDefinition, grounded = true) {
    if (!a.kit) return contactGap(a.state.fighter, slot, move, grounded);
    const reach = this.reachOf(a, slot, move, grounded);
    return Number.isFinite(reach) ? Math.max(PLAYER_RADIUS * 2, Math.min(1.25, reach - .3)) : 1.25;
  }

  removePlayer(id: string) {
    const going = this.actors.get(id);
    if (!going) return;
    this.actors.delete(id);
    this.adaptive.leave(id);
    this.collision?.remove?.(id);
    this.projectiles = this.projectiles.filter(p => p.actorId !== id);
    this.areas = this.areas.filter(each => each.actorId !== id);
    for (const actor of this.actors.values()) if (actor.state.target === id) actor.state.target = null;
    this.checkWinner();
  }

  /** Stop disconnected controls without deleting a vulnerable fighter or a fired attack. */
  clearPlayerInput(id: string) {
    const actor = this.actors.get(id);
    if (!actor) return;
    actor.input = { seq: actor.lastSeq, moveX: 0, moveZ: 0, yaw: actor.state.yaw };
    actor.lastInputAt = this.serverTime - .36;
    actor.state.guarding = false;
  }

  getPlayer(id: string): PlayerState | undefined {
    const p = this.actors.get(id)?.state;
    return p ? { ...p, cooldowns: { ...p.cooldowns } } : undefined;
  }

  submitInput(id: string, raw: unknown): boolean {
    const actor = this.actors.get(id);
    let input = validateInput(raw);
    if (input && actor && this.roomMode === 'training' && !actor.state.isBot) input = this.trainingLab.capture(input);
    if (!actor || !input || input.seq <= actor.lastSeq) return false;
    actor.lastSeq = input.seq;
    // Lag compensation: this tick less the server time of the frame the page drew (rewind).
    if (this.rewind > 0) actor.viewLag = input.view === undefined ? 0 : clamp(this.serverTime - input.view, 0, this.rewind);
    if(input.attack){actor.attackSeq=input.seq;actor.attackYaw=input.yaw;actor.attackAim=input.attack==='area'?input.aim:undefined;this.pressPace(actor,input.attack);}
    actor.lastInputAt = this.serverTime;
    // Preserve a pending edge if several movement packets arrive before the tick.
    actor.input = { ...input, jump: input.jump || actor.input.jump, dash: input.dash || actor.input.dash,
      awaken: input.awaken || actor.input.awaken, attack: input.attack ?? actor.input.attack };
    if (input.targetId !== undefined) {
      const target = input.targetId ? this.actors.get(input.targetId)?.state : null;
      actor.state.target = target && target.id !== id && target.alive && distance(actor.state, target) < 60 ? target.id : null;
      // A horde body is no fighter to lock the state onto; it is kept aside
      // for the swing to turn to.
      if (this.external) {const body=!target&&input.targetId?this.external.locate(input.targetId):undefined;actor.chosenExternal=body&&this.external.hostile?.(id,body)!==false?body.id:undefined;}
    }
    // Techniques (techniques.ts): the stick at the press, against the line to whoever is held (the facing without one).
    // A bot says its own (thinkBot); unsaid, a bot's is neutral - its run toward somebody is not a rush.
    if (input.attack) actor.attackDir = input.dir ?? (actor.state.isBot ? 'n' : this.stickAt(actor, input));
    return true;
  }
  /** Techniques: the stick in `input` against the line from `a` to whoever it holds, or its facing. */
  private stickAt(a: Actor, input: PlayerInput): StickDir {
    const p = a.state, q = p.target ? this.actors.get(p.target)?.state : undefined;
    const toX = q?.alive ? q.x - p.x : Math.sin(p.yaw), toZ = q?.alive ? q.z - p.z : Math.cos(p.yaw);
    return stickDir(input.moveX, input.moveZ, toX, toZ);
  }

  startMatch(): boolean {
    if (this.roomMode !== 'match' || this.status !== 'waiting' || this.actors.size < 2) return false;
    // The final roster owns the spawn sectors, not a fluctuating join count -
    // and which fighter gets which sector is drawn per match. Seats used to be
    // handed out in roster order, so the human who queued first always stood
    // in sector 0 with the same rival in sector 1. The field is spread evenly
    // round the twelve sectors, the ring is rotated by a random offset, and
    // the seating order is shuffled.
    // No waiting-room input edge, position, damage or resource advantage carries in.
    const seated = this.shuffle([...this.actors.values()]);
    // Round 3 of the stages (25 October 2026): a Duel on a place with an axis (StageDefinition.duelAxis) is seated on its
    // two ends, so each fighter's camera looks down it at the landmarks the place stands there; which end is whose is
    // the same one draw off the stream as the ring's turn was (every other room's draws, and the golden replays, stay).
    const axis = seated.length === 2 ? STAGES[this.stage].duelAxis : undefined;
    const drawn = Math.floor(this.random() * MAX_PLAYERS);
    const rotate = axis === undefined ? drawn : drawn % 2 * MAX_PLAYERS / 2;
    const taken: Vec3[] = [];
    seated.forEach((actor, seat) => {
      const sector = (Math.round(seat * MAX_PLAYERS / seated.length) + rotate) % MAX_PLAYERS;
      const spawn = safeSpawn(sector, this.stage, taken, axis); taken.push(spawn);
      actor.spawn = position(spawn);
      Object.assign(actor.state, spawn, { hp: actor.state.maxHp, stamina: actor.state.maxStamina ?? this.staminaMax, ultimate: 0, awakening: 0, alive: true,
        yaw: Math.PI, grounded: true, guarding: false, target: null, action: 'idle',
        actionStarted: this.serverTime, actionDuration: 0, actionTime: 0,
        kills: 0, damageDealt: 0, damageTaken: 0,
        cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0, area: 0 } });
      actor.vy = actor.kx = actor.kz = actor.stunUntil = actor.evadeUntil = actor.dashUntil = 0;
      actor.knockbackDrag = 7; actor.freezeUntil=0;actor.state.timeStopped=false;
      actor.reaction = null; actor.hitstopFrom = actor.hitstopUntil = actor.comboUntil = 0;
      actor.state.combo = 0; actor.state.hitstop = false;
      actor.launchSlot = undefined; actor.jumping = false;
      actor.groundedAt = actor.landedUntil = -Infinity; actor.leapt = false; // Round 4b (JUMP)
      actor.dashX = actor.dashY = actor.dashZ = actor.respawnAt = actor.chainHits = actor.scalingHits = actor.juggleHits = 0;
      actor.dashEntry = 0; actor.dashPlateau = 1; actor.dashSeconds = DASH_SECONDS; actor.dashKind = 'forward';
      actor.jumpAt = actor.dashAt = actor.attackAt = actor.awakenAt = actor.guardAt = -Infinity;
      actor.attackHold = actor.attackNotified = -Infinity; actor.reactionClip = .3; Object.assign(actor, pressClock());
      actor.wasGuarding = false; actor.guardHeld = false; actor.guardPressedAt = -Infinity;
      actor.guardReleasedAt = actor.parryLockUntil = actor.counterUntil = actor.parriedUntil = -Infinity; actor.parryCaught = false;
      actor.bounceOnLand = false; actor.launchLead = 0; actor.mx = actor.mz = 0; actor.blockedUntil = -Infinity;
      actor.rushUntil = actor.chaseUntil = actor.lightChaseUntil = actor.vanishedAt = -Infinity; actor.rushOpened = []; actor.chaseTargetId = actor.vanishOn = undefined; actor.dashChase = false;
      actor.awakenEntryUntil = 0; actor.state.awakened = false; actor.state.awakenedUntil = 0;
      actor.cast = null; actor.lastDamageAt = this.serverTime - 10;
      actor.input = { seq: actor.lastSeq, moveX: 0, moveZ: 0, yaw: Math.PI };
      actor.lastInputAt = this.serverTime;
      this.collision?.remove?.(actor.state.id);
    });
    for (const actor of seated) this.faceOff(actor);
    this.events.length = 0; this.projectiles.length = 0; this.areas.length = 0;
    this.hunts.clear(); this.dealt.clear(); this.winnerId = null;
    this.startedAt = this.serverTime;
    this.status = 'active';
    return true;
  }

  private emit(event: Omit<CombatEvent, 'id' | 'serverTime'>) {
    if (this.roomMode === 'training') this.trainingLab.event(event);
    this.events.push({ ...event, id: ++this.eventId, serverTime: this.serverTime });
    if (this.events.length > 256) this.events.shift();
  }

  /** Raise an impact freeze, as a window rather than a flag. A contact that
   *  lands while a fighter is already frozen extends the window they are in;
   *  one that lands after it opens a new one. The client derives its own
   *  boolean from [hitstopFrom, hitstopUntil) at its visual clock, so a light's
   *  0.08 s freeze is not rounded up to the 50 ms broadcast grid and an
   *  identical heavy does not weigh twice as much on one tick phase as on
   *  another. The simulation itself only ever reads these two fields. */
  private freeze(a: Actor, seconds: number) {
    // The ball rooms (SportFeel.hitstop): a sport's touches and tackles hold the play up less.
    const sport = this.assist?.sport;
    if (sport) seconds *= sport.hitstop;
    if (this.serverTime >= a.hitstopUntil) a.hitstopFrom = this.serverTime;
    a.hitstopUntil = Math.max(a.hitstopUntil, this.serverTime + seconds);
  }

  private action(a: Actor, action: PlayerState['action'], duration = 0, restart = false) {
    if (restart || a.state.action !== action || slots.includes(action as AttackSlot)) {
      a.state.actionStarted = this.serverTime;
      a.state.actionTime = 0;
      a.state.actionFrozen = 0;
    }
    a.state.action = action;
    a.state.actionDuration = duration;
  }

  /** The nearest living fighter inside a cone in front of `p`, by distance on
   *  the floor. `cos` is the cone's half-angle as a dot product. */
  private nearestInFront(p: PlayerState, reach: number, cos: number): PlayerState | undefined {
    let best: PlayerState | undefined, bestGap = Infinity;
    for (const other of this.actors.values()) {
      const q = other.state;
      if (!this.hostile(p, q) || !q.alive || !meleeHeight(p, q)) continue;
      const dx = q.x - p.x, dz = q.z - p.z, gap = Math.hypot(dx, dz);
      if (gap > reach + radiusOf(q) || gap < 1e-4) continue;
      if ((Math.sin(p.yaw) * dx + Math.cos(p.yaw) * dz) / gap < cos) continue;
      if (gap < bestGap) { bestGap = gap; best = q; }
    }
    return best;
  }

  /** A horde body as the approach reads a fighter: where it stands, and its
   *  size, so the drive stops at its edge rather than inside it. */
  private readonly externalView = { id: '', x: 0, y: 0, z: 0, size: 1, alive: false } as unknown as PlayerState;
  private externalAsState(id: string): PlayerState | undefined {
    const body = this.external?.locate(id);
    if (!body) return undefined;
    Object.assign(this.externalView, { id: body.id, x: body.x, y: body.y, z: body.z, size: body.radius / PLAYER_RADIUS, alive: true });
    return this.externalView;
  }

  /** Survival's aim (AimAssist): the body a blow thrown now should go to,
   *  within `radius` of the thrower's edge, all the way round. The one the
   *  player chose if it is in reach - a fighter or a horde body - else the
   *  nearest, with a slight lean toward whatever the view faces so two at a
   *  similar distance resolve to the one on screen. */
  private assistAim(a: Actor, radius: number): { actor?: PlayerState; body?: ExternalBody } | undefined {
    const p = a.state;
    const lock = p.target ? this.actors.get(p.target)?.state : undefined;
    if (lock?.alive && this.hostile(p, lock) && Math.abs(lock.y - p.y) < 2.2 && Math.hypot(lock.x - p.x, lock.z - p.z) <= radius + radiusOf(lock)) return { actor: lock };
    const chosen = a.chosenExternal ? this.external?.locate(a.chosenExternal) : undefined;
    if (chosen && this.external?.hostile?.(p.id,chosen)!==false && Math.abs(chosen.y - p.y) < 2.2 && Math.hypot(chosen.x - p.x, chosen.z - p.z) <= radius + chosen.radius) return { body: chosen };
    const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
    const score = (x: number, z: number, r: number) => {
      const dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz);
      if (d - r > radius) return Infinity;
      return Math.max(0, d - r) + (1 - (d > 1e-4 ? (dx * fx + dz * fz) / d : 1)) * .55;
    };
    let best: { actor?: PlayerState; body?: ExternalBody } | undefined, bestScore = Infinity;
    for (const other of this.actors.values()) {
      const q = other.state;
      if (!q.alive || !this.hostile(p, q) || Math.abs(q.y - p.y) > 1.8) continue;
      const s = score(q.x, q.z, radiusOf(q));
      if (s < bestScore) { bestScore = s; best = { actor: q }; }
    }
    if (this.external) {
      const n = this.external.query(p, p, radius, this.nearby);
      for (let i = 0; i < n; i++) {
        const body = this.nearby[i];
        if (this.external.hostile?.(p.id,body)===false || Math.abs(body.y - p.y) > 1.8) continue;
        const s = score(body.x, body.z, body.radius);
        if (s < bestScore) { bestScore = s; best = { body }; }
      }
    }
    return best;
  }

  /** True when `slot` may start now: either nothing is running, or the running
   *  move has connected, is past its first contact, and routes into `slot`. */
  private cancellable(a: Actor, slot: AttackSlot) {
    const cast = a.cast;
    if (!cast) return true;
    if (!cast.connected || this.serverTime < cast.start + cast.move.contacts[0]) return false;
    // A light pressed into a connected light is its string's next stage. It
    // takes over once this stage's own contacts are spent - Konta's barrage
    // and Ouga's two blasts play out whole - and the finisher, which has no
    // next stage, is never cut short by one: that press waits for it to end.
    if (cast.slot === 'light' && slot === 'light') {
      if (cast.branch === 'rise') return false;
      return cast.nextContact >= cast.move.contacts.length && cast.stage + 1 < this.rushLimit(cast.airborne);
    }
    return CANCEL_ROUTES[cast.slot].includes(slot);
  }

  /** How many stages a string may have: the whole rush on the ground, and
   *  no finisher in the air. */
  private rushLimit(airborne: boolean) { return airborne ? RUSH_AIR_STAGES : RUSH_STAGES; }

  /** The rush stage a light pressed now would be: the one after the light
   *  that is running, or after the one that finished inside RUSH_WINDOW; the
   *  fighter's own light again once the string is spent or has lapsed. */
  private rushStageFor(a: Actor): number {
    const cast = a.cast;
    const next = cast ? (cast.slot === 'light' ? cast.stage + 1 : 0)
      : this.serverTime <= a.rushUntil ? a.rushStage + 1 : 0;
    // Lock combat: a round's last stage hands on to the next round's first while the string has rounds left.
    if (next === LOCK_ROUND && this.lockRoundsLeft(a)) return 0;
    return next < this.rushLimit(cast ? cast.airborne : !a.state.grounded) ? next : 0;
  }

  /** Lock combat (lockCombat.ts): whether this fighter plays it here. */
  private locking(a: Actor) { return this.lockCombat && !a.kit && locks(a.state.fighter); }

  /** Lock combat: whether a hit on this fighter takes them out of the swing they are in - a light or a heavy, which
   *  the live rules armour against both. */
  private lockSwing(a: Actor) { return this.locking(a) && (a.cast?.slot === 'light' || a.cast?.slot === 'heavy') && !a.cast?.move.armoured; }

  /** Lock combat: the round of the light string running, or of the one just over inside RUSH_WINDOW. */
  private lockRoundOf(a: Actor) { return a.cast ? (a.cast.slot === 'light' ? a.cast.round ?? 0 : 0) : a.lockRound; }

  /** Lock combat: whether the ground string running (or just over, inside RUSH_WINDOW) has a round after this one. */
  private lockRoundsLeft(a: Actor) {
    if (!this.locking(a)) return false;
    const cast = a.cast;
    const ground = cast ? cast.slot === 'light' && !cast.airborne : this.serverTime <= a.rushUntil && a.state.grounded;
    return ground && this.lockRoundOf(a) < LOCK_ROUNDS - 1;
  }

  /** The next press queued behind the one just thrown (combos.ts), armed as if it were made now. */
  private nextPress(a: Actor) {
    const next = a.pressQueue?.[0]; if (!next) return;
    a.pressQueue = a.pressQueue!.length > 1 ? a.pressQueue!.slice(1) : undefined;
    a.attackAt = this.serverTime; a.attackSlot = next;
    a.attackHold = (a.cast ? Math.max(this.serverTime, a.cast.start + a.cast.move.duration) : this.serverTime) + INPUT_BUFFER;
    // Round 4b (COMBAT): queued, it was pressed ahead of the string: never on the beat, never a timed light.
    a.attackBeat = a.attackPaced = false;
  }

  /** Round 4b (COMBAT): the press's pace, on the clock it arrived by (submitInput: the server takes one command a
   *  tick), so an impact freeze that holds the fighter's own processing up cannot space two mashed presses apart. A
   *  light pressed sooner than MASH_INTERVAL after the last light is mashed, and the streak counts how many in a row;
   *  a heavy or a special pressed that soon after a light is rushed, and so never on the beat. */
  private pressPace(a: Actor, slot: AttackSlot) {
    const gap = this.serverTime - a.lightPressAt;
    // Lock combat: a pilot's presses are never mashed (lockCombat.ts) - lock combat is played by mashing.
    const mashed = gap < MASH_INTERVAL && !this.locking(a);
    if (slot !== 'light') { a.enderRushed = mashed; return; }
    a.mashStreak = mashed ? a.mashStreak + 1 : 0;
    a.lightPressAt = this.serverTime;
    // A mashed press taints the string it is pressed into: every stage it has left comes out mashed.
    if (a.mashStreak) a.stringMash = true;
  }

  /** Round 4b (COMBAT): what a press is, as it is heard (before it is queued or buffered): a light pressed at a pace
   *  is a timed light; a heavy or a special is on the beat or not (onBeat). */
  private notePress(a: Actor, slot: AttackSlot) {
    if (slot !== 'light') return { beat: !a.enderRushed && this.onBeat(a), paced: false };
    return { beat: false, paced: !a.mashStreak };
  }

  /** Round 4b (COMBAT): whether a heavy or a special pressed now ends its string on the beat: nothing waiting ahead of
   *  it, and the light stage it ends either playing and past its blow (BEAT_EARLY before it at the earliest) or just
   *  over, inside RUSH_WINDOW. Whether that stage landed is the cast's to say (cast(): an ender only cancels a stage
   *  that connected). */
  private onBeat(a: Actor) {
    if (a.kit) return false;
    if ((a.attackSlot === 'light' && this.serverTime <= a.attackHold) || a.pressQueue?.length) return false;
    const cast = a.cast;
    if (cast) return cast.slot === 'light' && this.serverTime - cast.start >= cast.move.contacts[0] - BEAT_EARLY;
    return this.serverTime <= a.rushUntil;
  }



  /** A press made while a light waits to carry a string on, for a fighter with enders (combos.ts): queued behind it
   *  rather than replacing it, so a quick L L L H is the four presses it was however slow the fighter's blows - the
   *  lights the string has stages left for, then the ender that closes it, a later ender replacing that one. A light
   *  past the string's end is mashing, and is the light already waiting. Anything else is the buffer everyone has, the
   *  newest press winning (false): the heavy pressed out of a finisher is that heavy. */
  private queuePress(a: Actor, slot: AttackSlot) {
    if (a.kit || !hasCombos(a.state.fighter) || a.attackSlot !== 'light' || this.serverTime > a.attackHold) return false;
    const next = this.rushStageFor(a), queue = a.pressQueue ?? [];
    if (next === 0) { a.pressQueue = undefined; return false; }
    const closed = queue.length > 0 && queue[queue.length - 1] !== 'light';
    if (slot !== 'light') a.pressQueue = closed ? [...queue.slice(0, -1), slot] : [...queue, slot];
    else if (!closed && next + 1 + queue.length < this.rushLimit(a.cast ? a.cast.airborne : !a.state.grounded)) a.pressQueue = [...queue, slot];
    return true;
  }

  /** The combo ender a heavy or special pressed now makes (combos.ts): off the floor, the air strike or the ground
   *  smash; on it, the ender of the light stage running, or of the one that finished inside RUSH_WINDOW. */
  private branchFor(a: Actor, slot: AttackSlot): ComboKey | undefined {
    const cast = a.cast;
    const stage = cast?.slot === 'light' ? cast.stage : !cast && this.serverTime <= a.rushUntil ? a.rushStage : -1;
    return this.heavyString(a, slot) ?? comboKeyFor(a.state.fighter, slot, stage, !a.state.grounded) ?? this.techniqueFor(a, slot, stage);
  }

  /** The heavy string's next blow (techniques.ts `hh`, `hhh`): a heavy into a heavy that landed, or pressed a moment
   *  after it ends - wherever that one is. A heavy that launches has its second blow rise to meet the body it threw
   *  (risingStrike), and the string goes on up there instead of the third press turning into the air heavy: fourteen
   *  fighters' heavies launch, and their Crushing Blow could not be thrown (2 November 2026, the techniques filmed). */
  private heavyString(a: Actor, slot: AttackSlot): TechniqueKey | undefined {
    if (slot !== 'heavy' || a.kit) return undefined;
    const cast = a.cast;
    if (cast) return cast.slot === 'heavy' && (!cast.branch || cast.branch === 'hh') && cast.connected ? cast.branch === 'hh' ? 'hhh' : 'hh' : undefined;
    return this.serverTime <= a.heavyChainUntil ? a.heavyChainStage >= 2 ? 'hhh' : 'hh' : undefined;
  }

  /** Techniques (techniques.ts): what a press makes that is no ender - with nothing running, the stick's opener (a light
   *  toward, away or across; a heavy toward or away; a light toward in the air); a light held back a beat after a
   *  string's second blow, the Delayed Strike. (The heavy string comes before the enders: heavyString.) `stage` is the
   *  light stage running or open (branchFor), -1 for none. */
  private techniqueFor(a: Actor, slot: AttackSlot, stage: number): TechniqueKey | undefined {
    const p = a.state, cast = a.cast, dir = a.attackDir;
    if (a.kit) return undefined;
    if (slot === 'light') {
      if (!p.grounded) return !cast && stage < 0 ? dir === 'f' ? 'airRush' : dir === 'b' ? 'airRise' : undefined : undefined;
      if (!cast && this.serverTime >= a.delayFrom && this.serverTime <= a.delayUntil) return 'delay';
      if (cast || stage >= 0) return undefined;
      // Out of its own dash (not a chase's), and just up off the floor: whichever way the stick is.
      if (this.serverTime < a.dashUntil && !a.dashChase) return 'dashStrike';
      if (this.serverTime - a.risenAt <= WAKE_WINDOW) return 'wakeUp';
      return dir === 'f' ? 'rush' : dir === 'b' ? 'rise' : dir === 's' ? 'slip' : undefined;
    }
    if (slot === 'heavy' && p.grounded) {
      if (cast || stage >= 0) return undefined;
      return dir === 'f' ? 'charge' : dir === 'b' ? 'counter' : undefined;
    }
    return undefined;
  }

  /** The stage this light cast would hand on to, if its string goes on. */
  private rushFollow(a: Actor, cast: Cast): MoveDefinition | undefined {
    if (a.kit || cast.slot !== 'light' || cast.stage + 1 >= this.rushLimit(cast.airborne)) return undefined;
    // Techniques: the Rising Strike launches - what follows it is the chase, not a string on the floor.
    if (cast.branch === 'rise') return undefined;
    // Lock combat: a second round's stage hands on to the second round's next.
    const second = cast.round ? lockRoundMove(a.state.fighter, cast.stage + 1, !!a.state.awakened) : undefined;
    return second ?? rushMove(a.state.fighter, cast.stage + 1, !!a.state.awakened);
  }

  /** Round 3b (TARGET): whom an attack starting now goes to, when the player
   *  is not holding a Tab lock (`input.lock === false`).
   *
   *  The soft target is the camera's: whoever it has been holding, kept there
   *  by a stickiness that exists so two fighters at a similar distance do not
   *  trade the shot back and forth. It was also the answer to whom every
   *  attack was for, and in a crowd that is the wrong answer: with Ouga
   *  1.1 m in front of Taisei and the camera on a Konta 2.9 m off to the side,
   *  the rush, the heavy and the special all went to Konta, and six of the
   *  nine single-target ultimates did the same. An attack now goes to the
   *  enemy the player faces as it starts: the nearest body within this move's
   *  reach (intentReach) that lies inside INTENT_COS of the way the view is
   *  aimed or of the way the fighter's body faces. Both, because the two
   *  part: the lock-on camera frames the soft target off to one side, and a
   *  fighter who has walked up to somebody else is facing them - in the
   *  critic's crowd the view was on Konta while Taisei stood face to face with
   *  Ouga, between him and the lens. The body a vanish stepped behind or a
   *  chase caught up with keeps its claim, as on the melee aim; a string's
   *  later stages, and a cancel out of a connected move, stay on the body the
   *  string began against while it is still in front and in reach. Nobody
   *  there, the soft target stands.
   *
   *  The fighter turns to the pick, and it
   *  becomes `target` for the whole cast (intentTick): the aim below reads
   *  it, and so do the approach, Cloudstep and a time stop's tour
   *  - and the snapshot, which turns the client's camera to it. A Tab lock
   *  wins instead: within this move's reach the fighter turns to the fighter
   *  locked, wherever they stand. A fighter on a side (arcade survival aims
   *  its own way) and anyone who does not say (bots, older clients) are left
   *  exactly as they were. */
  private chooseIntent(a: Actor, slot: AttackSlot, m: MoveDefinition, continuing: boolean) {
    const p = a.state;
    if (a.input.lock === undefined || a.kit || p.team !== undefined) return;
    const melee = m.style === 'melee', reach = this.intentReach(a, slot, m), view = p.yaw, body = a.faceYaw;
    if (a.input.lock) {
      // Round 3c (LOCK): to the lock whatever the reach - an attack out of
      // reach of it is thrown at it and whiffs, rather than at whoever the
      // view happens to be on (the lock decides where attacks go).
      const locked = this.hardLock(a);
      if (locked) this.turnTo(p, locked);
      return;
    }
    let pick: PlayerState | undefined;
    if (melee) {
      const strike = Math.max(m.range + m.radius + PLAYER_RADIUS, m.dashThrough ? DASH_THROUGH_REACH : 0);
      const vanishedOn = this.serverTime - a.vanishedAt <= VANISH_AIM && a.vanishOn ? this.actors.get(a.vanishOn)?.state : undefined;
      const chasedOn = a.dashChase && this.serverTime <= a.dashUntil + INPUT_BUFFER && a.chaseTargetId ? this.actors.get(a.chaseTargetId)?.state : undefined;
      pick = [vanishedOn, chasedOn].find(q => q?.alive && this.hostile(p, q) && distance(p, q) <= strike);
    }
    if (!pick && continuing && a.intent) {
      const prior = this.actors.get(a.intent)?.state;
      if (prior?.alive && this.hostile(p, prior) && this.inIntent(p, prior, reach, CHOSEN_AIM_COS, melee, view, body)) pick = prior;
    }
    pick ??= this.facingPick(p, reach, melee, view, body);
    a.intent = pick?.id ?? null;
    // The cast about to be made (cast() numbers it next).
    a.intentCast = a.castSerial + 1;
    if (!pick) return;
    p.target = pick.id;
    this.turnTo(p, pick);
  }

  /** Face `q` along the floor (nothing when standing on top of them). */
  private turnTo(p: PlayerState, q: PlayerState) {
    const dx = q.x - p.x, dz = q.z - p.z;
    if (Math.hypot(dx, dz) > 1e-4) p.yaw = Math.atan2(dx, dz);
  }

  /** How far a move reaches for the crowd rule: a shot's or a blast's range;
   *  a swing's own reach or, when it steps in, as far as its approach closes
   *  (the gap it strikes from plus `close`, else MAX_CLOSE); as far as
   *  Cloudstep goes, or a time stop holds. */
  private intentReach(a: Actor, slot: AttackSlot, m: MoveDefinition) {
    if (m.style !== 'melee') return m.range;
    let reach = Math.max(m.range + m.radius + PLAYER_RADIUS, m.dashThrough ? DASH_THROUGH_REACH : 0);
    if ((m.lunge ?? DEFAULT_MELEE_LUNGE) > 0) reach = Math.max(reach,
      Math.max(this.gapOf(a, slot, m, a.state.grounded), m.spacing ?? 0, m.chargeIn ? PUSH_RADIUS * 2 : 0) + (m.close ?? MAX_CLOSE));
    if (m.teleport) reach = Math.max(reach, m.teleport.reach);
    if (m.timeStop) reach = Math.max(reach, m.timeStop.radius);
    return reach;
  }

  /** How squarely `q` lies along either heading from `p` (the view's aim and
   *  the body's facing), as the larger of the two cosines. */
  private facingOf(p: PlayerState, q: PlayerState, view: number, body: number) {
    const dx = q.x - p.x, dz = q.z - p.z, flat = Math.hypot(dx, dz);
    if (flat < 1e-4) return 1;
    return Math.max(Math.sin(view) * dx + Math.cos(view) * dz, Math.sin(body) * dx + Math.cos(body) * dz) / flat;
  }

  /** Whether `q` is inside `reach` of `p` and inside the cone `cos` round
   *  either heading: on the floor and level enough to touch for a swing, in
   *  the open for a shot. A bigger body is reached sooner by its girth. */
  private inIntent(p: PlayerState, q: PlayerState, reach: number, cos: number, melee: boolean, view: number, body: number) {
    const dy = q.y - p.y, flat = Math.hypot(q.x - p.x, q.z - p.z);
    if (melee && !meleeHeight(p, q)) return false;
    if ((melee ? flat : Math.hypot(flat, dy)) > reach + radiusOf(q) - PLAYER_RADIUS) return false;
    return this.facingOf(p, q, view, body) >= cos;
  }

  /** The enemy `p` faces: the nearest body inside INTENT_COS of either
   *  heading and inside `reach`, leaning to the one more squarely in front
   *  when two are about as near (INTENT_TURN). Ties go by id, so a client's
   *  copy - which may hold the bodies in another order - picks as the server
   *  does. */
  private facingPick(p: PlayerState, reach: number, melee: boolean, view: number, body: number): PlayerState | undefined {
    let best: PlayerState | undefined, bestScore = Infinity;
    for (const other of this.actors.values()) {
      const q = other.state;
      if (!q.alive || !this.hostile(p, q) || this.gone(other) || !this.inIntent(p, q, reach, INTENT_COS, melee, view, body)) continue;
      const flat = Math.hypot(q.x - p.x, q.z - p.z);
      const score = (melee ? flat : Math.hypot(flat, q.y - p.y)) + INTENT_TURN * (1 - this.facingOf(p, q, view, body));
      if (score < bestScore - 1e-9 || (Math.abs(score - bestScore) <= 1e-9 && (!best || q.id < best.id))) { best = q; bestScore = score; }
    }
    return best;
  }

  /** Round 3b (TARGET), at the top of each fighter's tick, after the packets
   *  and before anything reads them. Notes which way the body faces, before a
   *  press turns it to the view (chooseIntent's second heading). And a
   *  soft-target cast keeps the body it picked as its `target` for as long as
   *  it runs: the client sends its soft target with every packet, and the
   *  approach, Cloudstep and a time stop's tour read `target` long
   *  after the cast began - left alone, a swing that turned to the body in
   *  front then drove on into the one the camera was on. A Tab lock pressed
   *  meanwhile takes over at once. */
  private intentTick(a: Actor) {
    a.faceYaw = a.state.yaw;
    if (!a.intent || a.cast?.id !== a.intentCast || a.input.lock !== false) return;
    const q = this.actors.get(a.intent)?.state;
    if (q?.alive) a.state.target = q.id;
  }

  /** Round 3c (LOCK): the fighter a Tab lock holds, while it is alive and
   *  hostile - nobody for a fighter on a side (arcade survival aims its own
   *  way), a kit body, or anyone not holding one (bots and older clients do
   *  not say). Every attack turns to it as it starts (chooseIntent) and a
   *  swing never snaps to anybody else instead (cast's `chosen`). */
  private hardLock(a: Actor): PlayerState | undefined {
    const p = a.state;
    if (a.input.lock !== true || a.kit || p.team !== undefined || !p.target) return undefined;
    const q = this.actors.get(p.target)?.state;
    return q?.alive && this.hostile(p, q) ? q : undefined;
  }

  /** Round 3c (LOCK): whether `q` is in the path of a blow leaving `from`
   *  along (dx, dy, dz): its centre LANE_FRONT or more in front of `from` on
   *  that line. A body beside the thrower or behind them is not, however wide
   *  the blow's volume - which is what let a shot, a beam and a cut measured
   *  from the thrower's own centre land on whoever stood at their shoulder
   *  (the critic's hard-lock table: five of eleven heavies and specials hit
   *  that body instead of the lock, three hit both). Allocates nothing. */
  private inLane(q: PlayerState, from: Vec3, dx: number, dy: number, dz: number) {
    const n = Math.hypot(dx, dy, dz);
    if (n < 1e-6) return true;
    const cy = q.y + (q.size ? 1.05 * q.size : 1.05);
    return ((q.x - from.x) * dx + (cy - from.y) * dy + (q.z - from.z) * dz) / n >= LANE_FRONT;
  }

  /** Round 3c (LOCK): whether a melee or beam contact of `cast` may land on
   *  `q` (sweep): anybody in the blow's lane, measured along the line the
   *  beam burns or the swing (or an iai's dash) runs. The body a swing is
   *  for - the lock, the pick, the one its dash was aimed at - keeps the
   *  swing's old rules, since a juggled body sits over its thrower rather
   *  than in front; a beam is aimed at its body's centre, so needs no
   *  exception. */
  private inBlowLane(a: Actor, cast: Cast, q: PlayerState, origin: Vec3, endpoint: Vec3) {
    // Arcade survival's sides fight their crowds their own way.
    if (a.state.team !== undefined || a.kit) return true;
    if (cast.move.style === 'beam') return this.inLane(q, origin, endpoint.x - origin.x, endpoint.y - origin.y, endpoint.z - origin.z);
    if (q.id === a.state.target || q.id === cast.aimId) return true;
    return this.inLane(q, origin, cast.direction.x, 0, cast.direction.z);
  }

  private cast(a: Actor, slot: AttackSlot): 'cast' | 'blocked' | 'cooling' | 'rejected' {
    const p = a.state;
    // A light is a stage of the rush string: its own light to open it, the
    // next stage when it continues one.
    // A body with a kit has no rush string: its light is one move.
    let stage = slot === 'light' && !a.kit ? this.rushStageFor(a) : 0;
    // A heavy or special pressed into a light stage, or just after one, or off the floor, is a combo ender (combos.ts);
    // with nothing running, the stick's technique, and a heavy into a heavy the heavy string (techniques.ts).
    let branch = a.kit ? undefined : this.branchFor(a, slot);
    // A technique thrown from neutral that is not ready again is the button's own move instead (techniques.ts).
    if (isTechnique(branch) && NEUTRAL_TECHNIQUES.has(branch) && (a.techniqueReady[branch] ?? -Infinity) > this.serverTime) branch = undefined;
    // The Delayed Strike is the string's third blow, held back: it stands in for that stage, in the round it is in.
    if (branch === 'delay') stage = 2;
    // Lock combat: a light that opens the next round of the string it follows (rushStageFor hands stage 0 on).
    const nextRound = !branch && slot === 'light' && stage === 0 && this.lockRoundsLeft(a)
      && (a.cast ? a.cast.slot === 'light' && a.cast.stage === LOCK_ROUND - 1 : a.rushStage === LOCK_ROUND - 1);
    const round = slot !== 'light' || !this.locking(a) ? 0 : branch === 'delay' ? a.lockRound : nextRound ? this.lockRoundOf(a) + 1 : stage > 0 ? this.lockRoundOf(a) : 0;
    // Awakened, the move may be a different one: KoKo's HUSH becomes the
    // barrage. The cast keeps this definition for its whole duration.
    const m = branch ? comboMove(p.fighter, branch, !!p.awakened)! : (round ? lockRoundMove(p.fighter, stage, !!p.awakened) : undefined) ?? this.moveOf(a, slot, stage);
    const mods = a.mods;
    const chaining = !!a.cast;
    if (!this.cancellable(a, slot) || this.serverTime < a.stunUntil || p.guarding || this.status !== 'active') return 'blocked';
    if (slot === 'light' && this.holdLight(a, stage)) return 'blocked';
    // Lock combat: the beat after a round. Whatever was pressed into it waits it out - held, not spent.
    if (this.serverTime < a.lockGapUntil && this.locking(a)) { a.attackHold = Math.max(a.attackHold, a.lockGapUntil + INPUT_BUFFER); return 'blocked'; }
    // Round 4b (COMBAT): Jump + Light pressed as the jump leaves the floor waits until it has (AIR_STRING_LIFTOFF).
    if (slot === 'light' && stage === 0 && a.jumping && !p.grounded && this.serverTime - a.jumpStartedAt < AIR_STRING_LIFTOFF) return 'blocked';
    // A chained normal is paid for by the move it cancels, not by its own
    // cooldown; specials and ultimates keep theirs so they stay commitments.
    // A rush stage is chained whether it cancelled the stage before it or
    // followed that stage inside the window.
    // (The heavy string's second and third blows and the Delayed Strike are chained too: a string's, not a fresh press's.)
    const gated = !(chaining || stage > 0 || nextRound || branch === 'hh' || branch === 'hhh' || branch === 'delay') || slot === 'special' || slot === 'ultimate' || slot === 'area';
    const staminaCost = mods ? m.stamina * mods.stamina : m.stamina;
    const reason = gated && (p.cooldowns[slot] ?? 0) > this.serverTime ? 'cooldown'
      : p.stamina < staminaCost && !(STAMINA_OVERDRAW && slot !== 'heavy') ? 'stamina'
      // The ultimate costs its own bar, awakened or not. The transformation
      // is bought with the awakening meter now, so it no longer pays for the
      // ultimate as well: an awakened fighter hits harder and takes less, and
      // still has to have earned the bar to throw the big one.
      : slot === 'ultimate' && p.ultimate < ULTIMATE_COST ? 'ultimate-meter' : null;
    // A cooldown is a wait, not a refusal: the press keeps its place in the
    // queue and fires on the frame the slot opens. Announced once per press,
    // because the HUD turns every refusal into a notice.
    if (reason === 'cooldown') {
      if (a.attackNotified !== a.attackAt) { a.attackNotified = a.attackAt; this.emit({ kind: 'rejected', actorId: p.id, slot, reason }); }
      return 'cooling';
    }
    if (reason) { this.emit({ kind: 'rejected', actorId: p.id, slot, reason }); return 'rejected'; }
    // A dash cancels into an attack. The dash lasts longer than the input
    // buffer, so gating attacks on it meant dash-into-anything simply could not
    // be pressed - the attack was refused and its buffer expired mid-dash.
    a.dashUntil = Math.min(a.dashUntil, this.serverTime);
    p.yaw=a.attackYaw??a.input.yaw;
    this.chooseIntent(a, slot, m, stage > 0 || chaining || nextRound); // Round 3b (TARGET): the enemy the player faces.
    p.stamina = Math.max(0, p.stamina - staminaCost);
    if (slot === 'ultimate') p.ultimate = 0;
    // A technique waits on its own clock, not its button's: a Rising Strike would otherwise hold the light that chases it.
    if (isTechnique(branch)) { if (m.cooldown > 0) a.techniqueReady[branch] = this.serverTime + (mods ? m.cooldown * mods.cooldown : m.cooldown); }
    else p.cooldowns[slot] = this.serverTime + (mods ? m.cooldown * mods.cooldown : m.cooldown);
    // Whatever is thrown closes the Delayed Strike's beat and the heavy string's window (a heavy string's blow opens it
    // again as it ends: updateCast).
    a.delayFrom = a.delayUntil = a.heavyChainUntil = -Infinity;
    // The sidestep: it slips every blow for its first moments.
    if (m.evade) a.evadeUntil = Math.max(a.evadeUntil, this.serverTime + m.evade);
    // Which of a kit's moves this is, for the renderer: one slot can hold any
    // of a boss's moves.
    if (a.kit) p.move = m.name;
    const from = attackOrigin(p,m);
    const locked = p.target ? this.actors.get(p.target)?.state : null;
    const target = locked && this.hostile(p, locked) ? locked : null;
    // Melee aims itself. A swing that passes a metre wide of someone standing
    // in front of you is most of what makes a fight read as two people
    // throwing moves at the air rather than at each other, and a mouse-look
    // yaw is never exactly on a moving opponent. The snap is a cone, not a
    // magnet: whoever is closest inside it, and only inside the move's own
    // reach, so it never turns a whiff at range into a hit.
    let aimedMelee:PlayerState|undefined,aimedExternal:ExternalBody|undefined;
    if (m.style === 'melee') {
      // An iai draw homes on whoever it can dash through.
      const reach = Math.max(m.range + m.radius + PLAYER_RADIUS, m.dashThrough ? DASH_THROUGH_REACH : 0);
      // The fighter the player is looking at wins the cone. Without this the
      // snap takes whoever is nearest, which in a royale is regularly somebody
      // the player did not choose and is not looking at. Round 3c (LOCK): a
      // Tab lock is chosen out of reach as well - the swing goes at it and
      // whiffs, and never snaps to somebody nearer instead.
      const chosen = this.hardLock(a) ?? (target?.alive && Math.hypot(target.x - p.x, target.z - p.z) <= reach && meleeHeight(p, target)
        && (Math.sin(p.yaw) * (target.x - p.x) + Math.cos(p.yaw) * (target.z - p.z))
          / (Math.hypot(target.x - p.x, target.z - p.z) || 1) >= CHOSEN_AIM_COS ? target : undefined);
      // Straight out of a vanish the back it stepped behind is the target,
      // cone or no cone: the camera is still turning round to it.
      const vanishedOn = this.serverTime - a.vanishedAt <= VANISH_AIM && a.vanishOn ? this.actors.get(a.vanishOn)?.state : undefined;
      const punish = vanishedOn?.alive && distance(p, vanishedOn) <= reach ? vanishedOn : undefined;
      // Straight out of a chase, likewise the body it chased: the press was
      // made before the chase turned the fighter round - an iai draw ends
      // facing away from the body it launched back past its shoulder.
      const chasedOn = a.dashChase && this.serverTime <= a.dashUntil + INPUT_BUFFER && a.chaseTargetId ? this.actors.get(a.chaseTargetId)?.state : undefined;
      const followUp = chasedOn?.alive && distance(p, chasedOn) <= reach ? chasedOn : undefined;
      let facing = punish ?? followUp ?? chosen;
      // Survival's hack-and-slash aim: whoever is nearest all the way round,
      // up to a stride past the swing's reach - the one the player chose
      // first - horde and fighters alike.
      if (!facing && this.assist) {
        const found = this.assistAim(a, reach + this.assist.magnet);
        if (found?.actor) facing = found.actor; else aimedExternal = found?.body;
      }
      facing ??= this.assist ? undefined : this.nearestInFront(p, reach, MELEE_AIM_COS);
      aimedMelee=facing;
      // At where the thrower saw them (lag compensation), which is where the contact will look for them.
      const faced = facing ? this.seenBy(a, facing) : undefined;
      if (faced) p.yaw = Math.atan2(faced.x - p.x, faced.z - p.z);
      else if (aimedExternal) p.yaw = Math.atan2(aimedExternal.x - p.x, aimedExternal.z - p.z);
    }
    let direction = { x: Math.sin(p.yaw), y: 0, z: Math.cos(p.yaw) };
    // A shot aims at the chosen fighter in range; in survival, failing that,
    // at the nearest body it can reach (see assistAim).
    let shotAim: Vec3 | undefined = target?.alive && distance(p, target) < m.range && m.style !== 'melee' ? centreOf(target) : undefined;
    if (!shotAim && this.assist && m.style !== 'melee') {
      const found = this.assistAim(a, m.range);
      shotAim = found?.actor ? centreOf(found.actor) : found?.body ? { x: found.body.x, y: found.body.y + found.body.height * .55, z: found.body.z } : undefined;
      // Round 4b (FMOVES): a shot aimed as it is let go keeps the horde body it was thrown at (shotTarget).
      if (m.aimOnRelease && !found?.actor && found?.body) aimedExternal = found.body;
    }
    if (shotAim) {
      const span = distance(from, shotAim) || 1;
      direction = { x: (shotAim.x - from.x) / span, y: (shotAim.y - from.y) / span, z: (shotAim.z - from.z) / span };
      p.yaw = Math.atan2(direction.x, direction.z);
    }
    let endpoint: Vec3 = { x: from.x + direction.x * m.range, y: from.y + direction.y * m.range, z: from.z + direction.z * m.range };
    if ((m.style === 'bomb'||m.style==='field') && target?.alive && distance(p, target) <= m.range) endpoint = centreOf(target);
    else if ((m.style === 'bomb'||m.style==='field') && this.assist && shotAim && distance(p, shotAim) <= m.range + 1.2) endpoint = shotAim;
    endpoint = this.collision?.raycast?.(from, endpoint) ?? endpoint;
    if (m.area) {
      endpoint = this.areaCentre(a, m, target);
      const dx = endpoint.x - p.x, dz = endpoint.z - p.z, span = Math.hypot(dx, dz);
      if (span > .3) { p.yaw = Math.atan2(dx, dz); direction = { x: dx / span, y: 0, z: dz / span }; }
    }
    a.attackAim = undefined;
    const nearbyMeleeTarget = !!traitsOf(p.fighter).lockNearMeleeLunge && m.style === 'melee' && target?.alive
      && Math.abs(target.y - p.y) < 1.5 && distance(p, target) <= m.range + m.radius + PLAYER_RADIUS
      && (target.x - p.x) * direction.x + (target.z - p.z) * direction.z > 0;
    // The string is charged to the breaker once: each stage inherits whom the
    // stages before it have already charged, so a whole rush is one cast
    // against the budget and a rush into a heavy into a special lands whole.
    // Copied rather than shared, so each stage keeps its own identity for the
    // shots it releases and the rollback checkpoint's map groups.
    const prior = a.cast;
    const opened = new Map<string, number>(stage > 0 || nextRound ? (prior?.slot === 'light' ? prior.opened : a.rushOpened) : []);
    a.rushUntil = -Infinity;
    // A charge-in or an iai draw is aimed at whoever the swing snapped to; a
    // charge-in thrown with them inside its distance slides back out first.
    const aimAt = m.style === 'melee' && (m.chargeIn || m.dashThrough) ? aimedMelee : undefined;
    const backstep = m.chargeIn && aimAt && p.grounded ? Math.max(0, m.chargeIn - Math.hypot(aimAt.x - p.x, aimAt.z - p.z)) : 0;
    // Round 4b (COMBAT): a light stage of a mashed string, and an ender pressed on the beat into a stage that landed. A
    // string opens fresh on the press that opens it: a timed one starts it clean.
    if (slot === 'light' && stage === 0 && !nextRound) a.stringMash = !a.attackPaced;
    const mash = slot === 'light' && !a.kit && a.stringMash;
    const beat = !!branch && !!a.attackBeat && (prior ? prior.slot === 'light' && prior.connected : a.rushOpened.length > 0);
    a.cast = { id: ++a.castSerial, stage, ...(round ? { round } : {}), slot, ...(branch ? { branch } : {}), ...(beat ? { beat } : {}), ...(mash ? { mash } : {}), move: m, start: this.serverTime, nextContact: 0, live: [], direction, endpoint,
      lungeTargetId: nearbyMeleeTarget ? target.id : m.lockAim&&!branch&&!p.awakened?aimedMelee?.id:undefined, connected: false, airborne: !p.grounded, opened,
      aimId: aimAt?.id, ...(aimedExternal ? { externalAim: aimedExternal.id } : {}), ...(backstep > .02 ? { backstep, backstepPlanned: backstep, backstepUntil: backstepWindow(p.fighter, m) } : {}) };
    this.action(a, slot, m.duration);
    if (!p.grounded) this.airborneOpener(a, a.cast); // Round 4b (JUMP)
    else if (m.style === 'melee' && !a.kit) {
      const on = aimedMelee ?? (target?.alive ? target : undefined);
      if (on) { a.cast.riseOn = on.id; this.risingStrike(a, a.cast); }
    }
    p.actionSeq=a.attackSeq;
    if (slot === 'light') p.chain = stage;
    // Lock combat: which round the light is in, so the page draws a second round's own blows (render/lockRound.ts).
    if (slot === 'light' && this.lockCombat) p.lockRound = round;
    p.branch = branch;
    // A normal thrown off the ground plays a kick where the rig has one, so it
    // is announced as one rather than as the grounded move it shares stats with.
    const airNormal = !branch && !p.grounded && this.drawsAirNormal(p, slot, stage)
      ? slot === 'light' ? airRushName(p.fighter, stage) : AIR_NORMALS[slot] : undefined;
    this.emit({ kind: 'cast', actorId: p.id, fighter: p.fighter, slot, actionSeq:p.actionSeq, chain: slot === 'light' ? stage : undefined, ...(round ? { round } : {}), ...(m.area ? { radius: m.radius } : {}),
      ...(branch ? { branch } : {}), move: airNormal ?? m.name, origin: from, endpoint, seed: Math.floor(this.random() * 2147483647) });
    return 'cast';
  }

  /** Whether an attack thrown off the ground is drawn as the air attack the
   *  rig was lent (AIR_NORMAL_FIGHTERS), which is what decides that `cast`
   *  announces it as one. It is not wherever something else is drawn in its
   *  place, and announcing the kick there named a move nobody could see -
   *  Taisei's Cloudstep read "Falling Kick" all round the arena:
   *  - awakened into a body of its own, which carries no air attacks: Kurobi
   *    and SUNRISE replace the fighter, and Iron Spirit takes over from
   *    KoKo (HUSH, which takes over from LORD ORO, has them);
   *  - a move played whole wherever it starts: Taisei's Rock and Instant
   *    Transmission (Fighter.groundedMelee) and LORD ORO's authored knife throw.
   *  tests/airNormals.test.ts holds this to what the renderer draws. */
  private drawsAirNormal(p: PlayerState, slot: AttackSlot, stage: number) {
    // Round 4b (COMBAT): every Vol.1 fighter's light off the floor is a stage of their own air string (moves.ts
    // AIR_RUSH), drawn with a clip of their own - Taisei's no longer his grounded Rock - except in a form that replaces
    // their body (Fighter draws the form's slot clips) and awakened KoKo's, which are Iron Spirit's own moves.
    const own = slot === 'light' && !!AIR_RUSH[p.fighter]?.[stage];
    const traits = traitsOf(p.fighter), grounded = traits.groundedOpeners;
    if (!own && !traits.airNormals) return false;
    if (p.awakened && (AWAKENINGS[p.fighter].kind === 'form' || traits.awakenedOwnMoves)) return false;
    return own || stage > 0 || !(grounded === 'all' || (!!grounded && grounded.includes(slot)));
  }

  step(dt = 1 / 60, waitingForInput?:ReadonlySet<string>) {
    if (!Number.isFinite(dt) || dt <= 0 || dt > 0.05) throw new Error('Step must be between 0 and 0.05 seconds');
    if (this.roomMode === 'training' && !this.trainingLab.shouldStep()) return;
    if (this.rewind > 0) this.record();
    this.serverTime += dt;
    this.tick++;
    // Countdown time advances, but entrants cannot walk into hazards, spend
    // resources or queue an advantage before the clean match start.
    if (this.status === 'waiting') return;
    this.retuneBots();
    for (const a of this.actors.values()) {
      const p = a.state;
      this.intentTick(a); // Round 3b (TARGET): the body's facing; a soft-target cast keeps its pick.
      this.cinematicTick(a); // Round 3d (ULTS): a hold nobody holds is let go; confirm/whiff marks cleared.
      // A fighter who has won is done being simulated: he holds his pose
      // rather than being handed back to the locomotion state machine, which
      // would put him straight back into idle on the next frame.
      if (this.status === 'finished' && p.id === this.winnerId && p.alive) {
        p.action = 'victory';
        continue;
      }
      if (!p.alive) {
        // A defeated body still has a clock. Its fall to the floor is driven
        // by `actionTime` exactly as every other reaction is, and this branch
        // used to `continue` before the clock below was advanced - so the
        // death clip sat on frame zero, which is a standing pose, for the
        // whole three seconds a body spends dead.
        p.actionTime = p.actionDuration > 0
          ? clamp((this.serverTime - p.actionStarted - (p.actionFrozen ?? 0)) / p.actionDuration, 0, 1) : 0;
        if (this.roomMode === 'training' && this.respawns && this.serverTime >= a.respawnAt) this.respawn(a);
        continue;
      }
      // The window closes on its own. Nothing else ends it: being hit out of a
      // transformation would make awakening a gamble rather than a decision.
      if (a.statuses) this.tickStatus(a);
      if (p.awakened && this.serverTime >= (p.awakenedUntil ?? 0)) {
        p.awakened = false; p.awakenedUntil = 0;
        this.emit({ kind: 'awaken-end', actorId: p.id, fighter: p.fighter });
      }
      p.timeStopped=this.serverTime<a.freezeUntil;
      if(p.timeStopped){
        // Freeze the sampled pose and its remaining authority timers together.
        p.actionFrozen=(p.actionFrozen??0)+dt;if(a.cast)a.cast.start+=dt;
        if(a.stunUntil>this.serverTime-dt)a.stunUntil+=dt;
        if(a.floorUntil>this.serverTime-dt)a.floorUntil+=dt; // Ground hits: the floor's limit holds with the stun.
        // Round 3e (REACT): and blockstun's guard with the stun it holds (see
        // the impact freeze below).
        if(a.blockedUntil>this.serverTime-dt)a.blockedUntil+=dt;
        if(a.parriedUntil>this.serverTime-dt)a.parriedUntil+=dt; // Round 5 (PARRY)
        if(a.dashUntil>this.serverTime-dt)a.dashUntil+=dt;
        if(a.evadeUntil>this.serverTime-dt)a.evadeUntil+=dt;
        if(a.awakenEntryUntil>this.serverTime-dt)a.awakenEntryUntil+=dt;
        // Nor the windows the fighter's own string and launch left open.
        if(a.rushUntil>this.serverTime-dt)a.rushUntil+=dt;
        if(a.chaseUntil>this.serverTime-dt)a.chaseUntil+=dt;
        if(a.lightChaseUntil>this.serverTime-dt)a.lightChaseUntil+=dt;
        if(a.lockGapUntil>this.serverTime-dt)a.lockGapUntil+=dt; // Lock combat: the beat, and the window.
        if(a.lockTo>this.serverTime-dt)a.lockTo+=dt;
        // Stopped time does not spend the transformation either.
        if(p.awakened&&(p.awakenedUntil??0)>this.serverTime-dt)p.awakenedUntil=(p.awakenedUntil??0)+dt;
        a.input.attack=undefined;a.input.dash=a.input.jump=false;
        continue;
      }
      // Impact freeze. Both fighters hold the frame they collided on, and every
      // authority timer holds with them so contacts and stun keep their spacing.
      // Round 3e (REACT): blockstun's guard (`blockedUntil`) among them. A
      // block raises stunUntil to it and freezes the defender, and only the
      // stun was carried through the freeze: the guard pose ran out the
      // freeze's length before the stun did, and for those two or three ticks
      // the defender was reported in a 'hurt' nothing hurt - every guarded
      // blow flinched on screen.
      p.hitstop = this.serverTime < a.hitstopUntil;
      if (p.hitstop) {
        p.actionFrozen = (p.actionFrozen ?? 0) + dt;
        if (a.cast) a.cast.start += dt;
        for (const key of ['stunUntil', 'blockedUntil', 'dashUntil', 'evadeUntil', 'comboUntil', 'awakenEntryUntil', 'rushUntil', 'chaseUntil', 'lightChaseUntil', 'parriedUntil', 'floorUntil', 'lockGapUntil', 'lockCounterUntil'] as const) {
          if (a[key] > this.serverTime - dt) a[key] += dt;
        }
        if (p.awakened && (p.awakenedUntil ?? 0) > this.serverTime - dt) p.awakenedUntil = (p.awakenedUntil ?? 0) + dt;
        continue;
      }
      // An owner command represents ONE tick. Between packets, extrapolating
      // the last direction spends movement the client never requested, then
      // discards the reversal when a burst arrives. Hold personal integration
      // briefly instead. World time, damage, released shots and defensive
      // expiry remain authoritative; this is not hitstop or invulnerability.
      a.inputGap=waitingForInput?.has(p.id)?(a.inputGap??0)+dt:0;
      if(a.inputGap>0&&!a.reaction&&this.serverTime>=a.stunUntil){
        const personalMotion=!p.grounded||a.jumping||a.dashUntil>this.serverTime-dt;
        // Round 3c (LOCK): not while a press already heard is waiting to go
        // off (a move pressed during the one that has just played out).
        if(a.inputGap>.35&&!personalMotion&&!a.cast&&this.serverTime>=a.awakenEntryUntil
            &&Math.hypot(a.kx,a.kz)<.01&&!(a.attackSlot&&this.serverTime<=a.attackHold)){
          // Ground travel still consumes one tick per command after a long
          // upload gap. Preserve consumed momentum for the eventual replay,
          // but remove held buttons/guard and show idle while waiting. World
          // reactions and residual external shove never enter this hold.
          this.clearPlayerInput(p.id);
          a.attackHold=a.attackAt=a.jumpAt=a.dashAt=a.awakenAt=a.rushUntil=a.chaseUntil=a.lightChaseUntil=-Infinity;
          a.attackSlot=undefined;a.pressQueue=undefined;this.action(a,'idle');p.actionTime=0;
          p.stamina=Math.min(p.maxStamina??100,p.stamina+STAMINA_REGEN*(a.mods?.staminaRecovery??1)*dt);
          continue;
        }
        if(a.inputGap<=.35&&(!a.cast||(a.cast.networkHold??0)+dt<=.35)
            &&(!personalMotion||(a.motionNetworkHold??0)+dt<=.35)){
          if(a.cast){a.cast.start+=dt;a.cast.networkHold=(a.cast.networkHold??0)+dt;}
          if(personalMotion)a.motionNetworkHold=(a.motionNetworkHold??0)+dt;
          if(p.actionDuration>0)p.actionFrozen=(p.actionFrozen??0)+dt;
          if(a.dashUntil>this.serverTime-dt)a.dashUntil+=dt;
          // The string's and the chase's windows are the fighter's own clock,
          // like the cast they follow: a held command does not spend them.
          if(a.rushUntil>this.serverTime-dt)a.rushUntil+=dt;
          if(a.chaseUntil>this.serverTime-dt)a.chaseUntil+=dt;
          if(a.lightChaseUntil>this.serverTime-dt)a.lightChaseUntil+=dt;
          // Round 3c (LOCK): and a press waiting for the held move to end
          // waits with it, or the hold would spend its buffer.
          if(a.cast&&a.attackHold>this.serverTime-dt)a.attackHold+=dt;
          if(a.jumping)a.jumpStartedAt+=dt;
          // Round 4b (JUMP): and the floor's, for the leap and the landing.
          a.groundedAt+=dt;if(a.landedUntil>this.serverTime-dt)a.landedUntil+=dt;
          if(!a.cast&&!p.guarding&&this.serverTime>=a.dashUntil)p.stamina=Math.min(p.maxStamina??100,p.stamina+STAMINA_REGEN*(a.mods?.staminaRecovery??1)*dt);
          continue;
        }
        // Withholding packets cannot hold a windup/dash indefinitely. Do not
        // extend evadeUntil, cooldowns, hit windows, reactions or awakening.
        // Round 3c (LOCK): nor throw away what the player has already done.
        // The move under way used to be cancelled here, its bar and stamina
        // spent: a page that hitched for 0.4 s after pressing its ultimate,
        // or for 0.15 s four times through Grand Tide's five-second
        // wind-up, lost it (the second critic's screenshots did exactly
        // that). Past the hold it plays out on the world's clock instead, and
        // a press already heard still goes off when cast() lets it.
        this.clearPlayerInput(p.id);a.dashUntil=0;a.mx=a.mz=0;
        a.jumpAt=a.dashAt=a.awakenAt=a.rushUntil=a.chaseUntil=a.lightChaseUntil=-Infinity;
      }
      if (this.serverTime >= a.comboUntil && p.combo) p.combo = 0;
      if (p.isBot && !a.external) this.thinkBot(a);
      if (a.poiseMax) this.regainPoise(a, dt);
      const stale = this.serverTime - a.lastInputAt > 0.35;
      const input = a.input;
      if (!a.cast && this.serverTime >= a.stunUntil && this.serverTime >= a.dashUntil) {
        // Travel and aim are separate. Animation facing never changes the velocity
        // requested by the stick; attacks/guard/dash use the view's aim heading.
        const travelling=Math.hypot(input.moveX,input.moveZ)>.01;
        // Just vanished and standing still: still facing the back they stepped
        // behind, whatever the camera - which has not caught up - says.
        const holdVanishFacing=this.serverTime-a.vanishedAt<=VANISH_AIM&&!travelling;
        if(!holdVanishFacing){
          if(input.guard||input.attack||input.dash)p.yaw=input.yaw;
          else if(travelling)p.yaw=Math.atan2(input.moveX,input.moveZ);
        }
      }
      // Recovery is movable. Being frozen for the whole move - up to five
      // seconds on an ultimate - is most of what reads as "a scripted animation
      // then a teleport home".
      const lastContact = a.cast ? a.cast.move.contacts[a.cast.move.contacts.length - 1] : 0;
      const grace = a.cast?.slot === 'light' ? LIGHT_RECOVERY_GRACE : RECOVERY_GRACE;
      const recovering = !!a.cast && this.serverTime >= a.cast.start + lastContact + grace;
      p.guarding = !stale && !!input.guard && !a.cast
        && this.serverTime >= a.stunUntil && this.serverTime >= a.dashUntil && p.stamina > 0;
      // The parry window belongs to the press, not to the pose - and the pose
      // is not a reliable witness to the press. `p.guarding` above is derived
      // through `stunUntil`, which every blocked hit raises for the length of
      // blockstun, so a held guard was forced false and then true again on
      // every single block while the button had not moved. That re-stamped the
      // window, and because the attacker is plus on block their next light
      // landed inside it: measured over 600 ticks of a held block, every
      // fighter in the roster blocked nine times and parried seven to ten of
      // them, with no input from the defender at all.
      //
      // So the press is remembered raw, and the window is dated from it when
      // the guard actually comes up. A guard that only dropped because
      // blockstun forced it down carries its original press date, which is
      // long expired. A press made during a dash or a cast still counts, from
      // when it was made - if the pose arrives inside the window it parries,
      // and if the dash was long it does not, which is what pressing too early
      // should mean.
      const guardHeld = !stale && !!input.guard;
      if (guardHeld && !a.guardHeld) {
        // Lock combat: a press in the gap after a round is the escape; one after the window, while still held, is late.
        // Judged by when the defender saw it (rewind: the server's rooms; the frame the press was made on, as far back
        // as LOCK_ESCAPE_REWIND): online a press made in the window on their screen arrives a round trip and the page's
        // drawing delay later, and judged on arrival the escape was all but impossible past 50 ms
        // (scripts/combat/lock_latency.mts).
        const seen = this.rewind > 0 && input.view !== undefined ? Math.min(this.serverTime, Math.max(input.view, this.serverTime - LOCK_ESCAPE_REWIND)) : this.serverTime;
        if (a.lockCounterOn && seen <= a.lockCounterUntil) this.lockCounter(a);
        // (A bot its mode's brain drives - Rift War's, the objectives' - escapes as often as the simulation's own do
        // (LOCK_BOT_ESCAPE, by skill), one roll a press: those brains put their guard up at any blow coming, and in the
        // window that is an escape - Bad Blood's bots got out of 70% of rounds, against 4-15%.)
        else if (a.lockBy && seen <= a.lockTo && !(a.external && p.isBot && this.random() >= LOCK_BOT_ESCAPE[0] + (LOCK_BOT_ESCAPE[1] - LOCK_BOT_ESCAPE[0]) * a.botSkill)) this.lockEscape(a);
        else if (a.lockBy && this.serverTime < a.stunUntil) { this.emit({ kind: 'lock-escape', actorId: p.id, targetId: a.lockBy, reason: 'late' }); a.lockBy = ''; }
        a.guardPressedAt = this.serverTime;
        // Round 5 (PARRY): only a fresh press opens the window - the button
        // up for PARRY_REARM first, and no whiffed window's lockout running.
        // Mashing F never lets go for long enough; fishing with taps whiffs
        // into the lockout. Either way the guard still comes up and blocks.
        // Parry for people: and a guard a bot's own brain raises opens one only when it is a parry the bot has
        // timed (botAnswer) - never a block or a turtle raised close to a blow (BOT_GUARD_LEAD). The practice
        // room's dummy, driven by the lab (a recorded tape, a behaviour), has no plan and presses as recorded.
        const fresh = this.serverTime - a.guardReleasedAt >= PARRY_REARM - 1e-9 && this.serverTime >= a.parryLockUntil
          && !(p.isBot && a.botGuardUntil !== undefined && !a.botTimed);
        a.guardAt = fresh ? this.serverTime : -Infinity; a.parryCaught = false;
      }
      if (!guardHeld && a.guardHeld) a.guardReleasedAt = this.serverTime;
      a.guardHeld = guardHeld;
      // A window that closed on nothing - the press whiffed - locks the next
      // ones out (PARRY_LOCKOUT); one that caught a blow does not.
      if (a.guardAt > -Infinity && this.serverTime - a.guardAt > JUST_GUARD_WINDOW) {
        if (!a.parryCaught) a.parryLockUntil = a.guardAt + JUST_GUARD_WINDOW + PARRY_LOCKOUT;
        a.guardAt = -Infinity;
      }
      if (p.guarding && !a.wasGuarding) { a.attackHold = -Infinity; a.pressQueue = undefined; }
      a.wasGuarding = p.guarding;
      // Going to guard is a change of mind: the string is over.
      if (p.guarding) a.rushUntil = -Infinity;
      const controllable = this.serverTime >= a.stunUntil && !a.reaction
        && (!a.cast || recovering) && this.status !== 'finished';
      // Commands are buffered, not sampled. Chasing a launch otherwise means
      // pressing jump on exactly the frame the launcher's recovery opens.
      if (input.jump) a.jumpAt = this.serverTime;
      // A dash is a change of mind. It drops a swing that has been waiting on
      // the running move rather than throwing it most of a second later; an
      // attack in the same packet is the dash cancel, and re-arms below.
      if (input.dash) { a.dashAt = this.serverTime; a.attackHold = -Infinity; a.pressQueue = undefined; }
      const press = input.attack ? this.notePress(a, input.attack) : undefined; // Round 4b (COMBAT)
      if (input.attack && !this.queuePress(a, input.attack)) {
        a.attackAt = this.serverTime; a.attackSlot = input.attack; a.attackBeat = press!.beat; a.attackPaced = press!.paced;
        // Held for the move that is running, or for a chase to arrive: the
        // follow-up to a chase is pressed while it is still in the air.
        a.attackHold = (a.cast ? Math.max(this.serverTime, a.cast.start + a.cast.move.duration)
          : a.dashChase ? Math.max(this.serverTime, a.dashUntil) : this.serverTime) + INPUT_BUFFER;
      }
      // What was queued behind a press that lapsed unthrown lapses with it.
      if (a.pressQueue && this.serverTime > a.attackHold) a.pressQueue = undefined;
      if (input.awaken) a.awakenAt = this.serverTime;
      input.jump = input.dash = input.awaken = false; input.attack = undefined;
      const held = (at: number) => this.serverTime - at <= INPUT_BUFFER;
      // A light pressed inside the window after this fighter's own finisher or
      // heavy launched somebody is the chase: the dash below starts it the
      // moment the move it follows lets go, and the press waits for it to
      // arrive (cast() holds it meanwhile - see holdLight).
      const lightChase = a.attackSlot === 'light' && this.serverTime <= a.attackHold ? this.chaseByLight(a) ?? this.dashIn(a) : undefined;
      // Awaken. A full awakening bar, both feet free, and nothing else running:
      // the transformation is a commitment, not a cancel. It costs the whole
      // meter and a second of standing still, and the second is invulnerable.
      // The bar it costs is the one damage TAKEN fills - the fighter who is
      // losing the exchange is the one who gets to turn it round.
      if (held(a.awakenAt) && !p.awakened && (p.awakening ?? 0) >= AWAKENING_COST && this.status === 'active'
          && this.serverTime >= a.stunUntil && !a.reaction && !a.cast && p.grounded) {
        a.awakenAt = -Infinity;
        p.awakening = 0;
        p.awakened = true;
        p.awakenedUntil = this.serverTime + AWAKENING_SECONDS + (a.mods?.awakenSeconds ?? 0);
        a.awakenEntryUntil = this.serverTime + AWAKENING_ENTRY;
        a.stunUntil = Math.max(a.stunUntil, a.awakenEntryUntil);
        a.evadeUntil = Math.max(a.evadeUntil, a.awakenEntryUntil);
        a.kx = a.kz = 0; a.dashUntil = Math.min(a.dashUntil, this.serverTime);
        this.action(a, 'awaken', AWAKENING_ENTRY, true);
        this.emit({ kind: 'awaken', actorId: p.id, fighter: p.fighter, move: AWAKENINGS[p.fighter].name });
      }
      // Air recovery. Being launched is only fun if you can land on your feet,
      // and without it every launcher is a guaranteed knockdown.
      if (a.reaction === 'launched' && !p.grounded && (held(a.jumpAt) || held(a.dashAt))
          && p.stamina >= TECH_STAMINA && this.serverTime >= a.lastDamageAt + TECH_DELAY) {
        p.stamina -= TECH_STAMINA;
        a.reaction = null;
        a.stunUntil = this.serverTime + .12;
        a.vy = Math.max(a.vy, -2.5); a.kx *= .3; a.kz *= .3; a.knockbackDrag = 9;
        a.evadeUntil = Math.max(a.evadeUntil, this.serverTime + .3);
        a.jumpAt = a.dashAt = -Infinity;
        this.emit({ kind: 'tech', actorId: p.id });
      }
      // Round 4b (JUMP): not inside a full jump's landing (JUMP_LAND_RECOVERY): the press waits for it.
      const sport = this.assist?.sport;
      if (controllable && !p.guarding && held(a.jumpAt) && p.grounded && this.serverTime >= a.landedUntil) { a.vy = jumpArc(p.fighter).speed * (sport?.jump ?? 1); a.leapt = this.leap(a, input, stale); p.grounded = false; a.jumping = true; a.motionNetworkHold=0;a.jumpStartedAt = this.serverTime; a.jumpAt = -Infinity; }
      // The ball rooms (SportFeel.airJumps): a jump pressed off the floor goes up again - the double jump an aerial is
      // made of - a beat after the last one left (a held press is not two), never out of a reaction's hands.
      else if (sport && controllable && !p.guarding && held(a.jumpAt) && !p.grounded && !a.reaction && a.airJumps < sport.airJumps
        && this.serverTime - a.jumpStartedAt >= .12) {
        a.airJumps++; a.vy = Math.max(a.vy, jumpArc(p.fighter).speed * sport.jump * sport.airJump);
        a.jumping = true; a.motionNetworkHold = 0; a.jumpStartedAt = this.serverTime; a.jumpAt = -Infinity;
        if (!a.cast) this.action(a, 'jump', 0, true);
      }
      // Only out of a move that did something. Dashing out of recovery is the
      // escape valve that keeps exchanges continuous, but `recovering` opens
      // four frames after the last active frame whether or not anything was
      // there - so a whiff cost nothing at all. Measured, the frame of the
      // next cast after swinging at empty air, without a dash and with one:
      // Kenzo's heavy 73 -> 42, his Phoenix 164 -> 98, Nigo's NIGHTFALL
      // 314 -> 191, Gummy's Grand Tide 470 -> 305. A twenty-second ultimate
      // thrown at nothing had one frame of recovery, and 7.8 frames of
      // invulnerability attached to the escape. Spacing, baiting and whiff
      // punishing are the read layer that makes a fight a fight, and none of
      // them existed.
      //
      // A blocked move still counts: `hit` marks the cast connected before the
      // guard branch returns, which is deliberate - a guard is not a wall.
      const escapable = !a.cast || a.cast.connected;
      if (controllable && escapable && !p.guarding && (held(a.dashAt) || lightChase) && (p.stamina >= 20 || this.chaseOverdraws(a, lightChase)) && this.serverTime >= a.dashUntil + (sport?.dashGap ?? 0.35)
        && this.serverTime >= a.landedUntil) { // Round 4b (JUMP): nor a dash inside a full jump's landing.
        a.dashAt = -Infinity;
        a.motionNetworkHold=0;
        p.stamina = Math.max(0, p.stamina - 20);
        a.cast = null;
        // A dash is a change of mind: whatever string was running is over.
        a.rushUntil = -Infinity; a.dashChase = false;
        const n = Math.hypot(input.moveX, input.moveZ);
        a.dashX = n > 0.1 ? input.moveX / n : Math.sin(p.yaw);
        a.dashZ = n > 0.1 ? input.moveZ / n : Math.cos(p.yaw);
        a.dashY = 0;
        // Which dash this is depends on where the stick is against the
        // facing. Pulled back it is a backdash - shorter, with the evade on
        // its first part - and across it is a sidestep, shorter again and
        // with no evade at all. Forward and neutral are the dash as it was,
        // to the byte: every bot read is calibrated on its ground.
        const along = n > 0.1 ? a.dashX * Math.sin(p.yaw) + a.dashZ * Math.cos(p.yaw) : 1;
        a.dashKind = along < BACKDASH_ALONG ? 'back' : Math.abs(along) < SIDESTEP_ALONG ? 'side' : 'forward';
        p.dashKind = a.dashKind;
        a.dashSeconds = a.dashKind === 'back' ? BACKDASH_SECONDS : a.dashKind === 'side' ? SIDESTEP_SECONDS : DASH_SECONDS;
        a.dashSpeed = a.dashKind === 'back' ? BACKDASH_SPEED : a.dashKind === 'side' ? SIDESTEP_SPEED : 24;
        a.dashUntil = this.serverTime + a.dashSeconds;
        if (a.dashKind === 'forward') a.evadeUntil = this.serverTime + DASH_EVADE;
        else if (a.dashKind === 'back') a.evadeUntil = this.serverTime + BACKDASH_EVADE;
        // Airborne with someone locked, the dash is a chase: it aims at them
        // instead of straight ahead, which is what makes a launch followable.
        // Its reach is the gap, not a fixed distance - a full-length dash at a
        // target a metre and a half away lands three metres past them.
        const locked = p.target ? this.actors.get(p.target)?.state : undefined;
        // Inside the chase window after this fighter's own launch, the dash
        // goes after the body that launch sent flying - from the ground as
        // well as from the air, and whoever is locked.
        // A light that is the chase goes after the same body.
        const chased = lightChase
          ?? (this.serverTime <= a.chaseUntil && a.chaseTargetId ? this.actors.get(a.chaseTargetId) : undefined);
        if (chased?.state.alive && distance(p, chased.state) <= CHASE_RANGE) this.startChase(a, chased, !!lightChase);
        else if (!p.grounded && locked?.alive) {
          const dx = locked.x - p.x, dy = (locked.y + 0.9) - (p.y + 0.9), dz = locked.z - p.z;
          const span = Math.hypot(dx, dy, dz);
          if (span > 0.4) {
            a.dashX = dx / span; a.dashY = dy / span; a.dashZ = dz / span;
            // The chase is the plain dash's length whatever the stick said.
            a.dashKind = 'forward'; a.dashSeconds = DASH_SECONDS;
            a.dashUntil = this.serverTime + DASH_SECONDS; a.evadeUntil = this.serverTime + DASH_EVADE;
            a.dashSpeed = clamp((span - PLAYER_RADIUS * 2) / DASH_SECONDS, 4, AIR_DASH_SPEED);
          }
        }
        // The ball rooms (SportFeel.airDash): in the air, at the chosen body (the ball) when it is near and the way the
        // stick says (or the facing, the stick let go) - the aerial, sized to arrive on it as the chase is to its body.
        else if (!p.grounded && sport?.airDash && a.chosenExternal) {
          const body = this.external?.locate(a.chosenExternal);
          const dx = body ? body.x - p.x : 0, dy = body ? body.y + body.height * .55 - (p.y + .9) : 0, dz = body ? body.z - p.z : 0;
          const span = Math.hypot(dx, dy, dz), flat = Math.hypot(dx, dz);
          if (body && span > .4 && span <= sport.airDash && (flat < .5 || (dx * a.dashX + dz * a.dashZ) / flat >= .35)) {
            a.dashX = dx / span; a.dashY = dy / span; a.dashZ = dz / span;
            a.dashKind = 'forward'; a.dashSeconds = DASH_SECONDS;
            a.dashUntil = this.serverTime + DASH_SECONDS; a.evadeUntil = this.serverTime + DASH_EVADE;
            a.dashSpeed = clamp((span - body.radius * .5) / DASH_SECONDS, 6, AIR_DASH_SPEED);
          }
        }
        // The ball rooms (SportFeel.boost): a forward dash on the floor runs on as a boost (see the run below).
        if (sport && p.grounded && a.dashKind === 'forward' && a.dashY === 0 && !a.dashChase) a.boosting = true;
        p.dashKind = a.dashKind;
        // A ground dash is shaped around the run it interrupts; the chases
        // above are sized to their target and keep the bare shape.
        if (a.dashY === 0 && !a.dashChase) this.shapeGroundDash(a, input, dt);
        this.action(a, 'dash', a.dashSeconds);
      }
      // Attacks are not gated on `controllable`: a cancel has to fire the moment
      // the move connects, not once its recovery window opens. cast() decides
      // whether the running move may be cancelled into this one, and a press it
      // refuses outright is spent rather than retried for the whole window.
      // A chase is the exception to an attack cutting a dash short: the
      // press waits for it to arrive (see attackHold), or mashing the
      // follow-up would drop the chaser out of the sky halfway there.
      // A chase is aimed once, at where the launch would carry them. A body
      // stopped on the way - stuck to a wall, back on the floor - is not up
      // there any more: the chase ends where it is, and the follow-up comes
      // out at them from wherever that is instead of from a point in the air.
      if (a.dashChase && this.serverTime < a.dashUntil && a.chaseTargetId) {
        const chased = this.actors.get(a.chaseTargetId);
        // Its climb stops with it: the burst is what was lifting it.
        if (!chased?.state.alive || chased.reaction === 'splat' || (chased.state.grounded && chased.vy <= 0)) { a.dashUntil = this.serverTime; a.vy = Math.min(a.vy, 0); }
      }
      const chasing = a.dashChase && this.serverTime < a.dashUntil;
      // Round 5 (PARRY): the parry's punish. An attack pressed while the
      // parried thrower still reels goes out with the guard still held - the
      // guard drops for it - instead of waiting for the button to come up.
      if (p.guarding && this.serverTime < a.counterUntil && a.attackSlot && this.serverTime <= a.attackHold) p.guarding = false;
      if (!chasing && this.serverTime <= a.attackHold && a.attackSlot && this.serverTime >= a.stunUntil && !a.reaction && this.status === 'active') {
        const outcome = this.cast(a, a.attackSlot);
        // 'blocked' is "not yet" and 'cooling' is "not until the slot opens":
        // both keep the press. Anything else spends it, and the next queued press takes its place.
        if (outcome !== 'blocked' && outcome !== 'cooling') { a.attackAt = a.attackHold = -Infinity; this.nextPress(a); }
      }

      // The ball rooms (SportFeel): a sport's run, and the boost a dash runs on into while the stick holds and the stamina
      // lasts (spent below, where the stamina comes back).
      if (sport) {
        if (a.boosting && (Math.hypot(input.moveX, input.moveZ) < .5 || p.stamina <= 0 || p.guarding || stale || this.serverTime < a.stunUntil || a.reaction)) a.boosting = false;
        if (a.boosting) p.boost = true; else if (p.boost) delete p.boost;
      }
      let speed = p.guarding ? 2.2 : sport ? (a.boosting ? sport.boost : sport.run) : 7.5;
      if (p.awakened) speed *= AWAKENED_SPEED;
      speed *= this.slowOf(a);
      if (a.mods) speed *= a.mods.speed;
      // User travel has the same controller during every attack and recovery.
      // Only actual gameplay restrictions (guard, hitstun, freeze) constrain it.
      if (this.serverTime < a.stunUntil || stale || this.status === 'finished') speed = 0;
      const n = Math.max(1, Math.hypot(input.moveX, input.moveZ));
      // Round 4b (JUMP): a jump keeps the leap it left the floor with (see leap)
      // for as long as the stick holds it; it can be steered, and let go of, but
      // the air is never asked to brake it back to a run.
      const travel = a.jumping && !p.grounded && !a.cast && speed > 0 ? Math.max(speed, Math.hypot(a.mx, a.mz)) : speed;
      // Isotropic travel: facing, clip choice and lock-on cannot tax a direction.
      const wantX = input.moveX / n * travel, wantZ = input.moveZ / n * travel;
      // Feet, not a switch. The velocity ramps toward what the stick is asking
      // for; stopping is quicker than starting. A fighter the reaction owns is
      // not walking at all, so their own velocity is dropped outright rather
      // than braked - the knockback is what is moving them.
      if (this.serverTime < a.stunUntil) { a.mx = a.mz = 0; }
      else {
        const turning=(wantX*a.mx+wantZ*a.mz)<Math.hypot(wantX,wantZ)*Math.hypot(a.mx,a.mz)*.7;
        const rate = (turning?GROUND_TURN_ACCEL:Math.hypot(wantX, wantZ) >= Math.hypot(a.mx, a.mz) ? GROUND_ACCEL : GROUND_BRAKE)
          * (p.grounded ? 1 : AIR_CONTROL) * (sport?.feet ?? 1) * dt;
        // The whole change is clamped, not each axis: clamping them separately
        // lets a diagonal ramp up at rate*sqrt(2), which is the same diagonal
        // advantage the normalised input exists to remove.
        const gapX = wantX - a.mx, gapZ = wantZ - a.mz, gap = Math.hypot(gapX, gapZ);
        if (gap > 1e-6) {
          const take = Math.min(gap, rate) / gap;
          a.mx += gapX * take; a.mz += gapZ * take;
        }
      }
      let vx = a.mx, vz = a.mz;
      if (this.serverTime < a.dashUntil) {
        // Shaped rather than square. The ground ramp exists because a one-tick
        // velocity step reads as weightless, and the dash was a step three
        // times larger than the one that ramp was built for. Total ground
        // covered is unchanged: the peak is raised to pay for the ramps.
        const through = 1 - (a.dashUntil - this.serverTime) / a.dashSeconds;
        let burst = a.dashSpeed * dashShape(through);
        if (a.dashY !== 0 || a.dashChase) {
          // The air chase: sized to stop beside its target, so it keeps the
          // bare shape and leaves at a run rather than at a standstill. A
          // launch chase hands back only a drift: it has arrived at striking
          // distance, and a run's worth of momentum would carry it past.
          const exit = Math.min(a.dashSpeed, a.dashChase ? CHASE_EXIT : 7.5);
          vx = a.dashX * burst; vz = a.dashZ * burst;
          a.mx = a.dashX * exit; a.mz = a.dashZ * exit;
          a.vy = a.dashY * burst;
        } else {
          // The shape is sampled at zero on the tick the dash begins and it
          // replaces the run outright, so a fighter at full sprint was planted
          // for one frame and then fired; at the far end it falls to a metre
          // and a half a second and the run was handed back as a flat 7.5,
          // which is the same pop the other way. The rise is floored at the
          // speed the fighter arrived with and the fall at the speed the run
          // is about to hand back - which is nothing if the stick has been
          // let go, so a dash into a stop still stops - and the plateau was
          // sized at the start to give back exactly what the floors add.
          // Round 4b (JUMP): jumped out of this dash, it hands back the jump's
          // leap rather than the run (a dash-jump carries at least as far as a
          // running one).
          const exit = this.dashExit(a, input) * (a.jumping && a.leapt && a.jumpStartedAt >= a.dashUntil - a.dashSeconds ? jumpArc(p.fighter).leap : 1);
          burst = Math.max(burst * a.dashPlateau, through < DASH_RISE ? a.dashEntry : through > 1 - DASH_FALL ? exit : 0);
          vx = a.dashX * burst; vz = a.dashZ * burst;
          a.mx = a.dashX * exit; a.mz = a.dashZ * exit;
        }
      }
      // A charge-in's slide back and an iai draw's dash: the move's own
      // travel, which, like the approach, a held stick overrides.
      if (a.cast && !recovering) {
        const own = this.castMotion(a, dt, Math.hypot(input.moveX, input.moveZ) >= .05);
        if (own) { vx += own.x; vz += own.z; }
      }
      const approach = this.approach(a);
      // Held at the fighter the swing is going for, the stick is a chase, not a step away: the step-in and the
      // steering stay on (CHASE_STICK_COS), and the stick's own run is kept wherever it is the faster of the two.
      // And held at the mode's own body the swing is aimed at (cast.externalAim: a Rift
      // camp, a horde body), likewise. Only fighters counted, so the stick's run went on at full speed through a body
      // with no pushbox: a Rush Strike thrown toward a camp 2 m off ran its thrower past the camp's middle before a
      // slow tempo's contact (Konta's Foxpack Rush, 0.31 s) and the blow, behind him now, whiffed (RiftBrain.test.ts).
      const stick = Math.hypot(input.moveX, input.moveZ);
      let pursuing = false;
      if (approach && stick >= .05) {
        const chased = approach.acquired ?? (p.target ? this.actors.get(p.target)?.state : undefined);
        if (chased?.alive) {
          const seen = this.actors.has(chased.id) ? this.seenBy(a, chased) : chased, dx = seen.x - p.x, dz = seen.z - p.z, gap = Math.hypot(dx, dz) || 1;
          pursuing = (input.moveX * dx + input.moveZ * dz) / (gap * stick) >= CHASE_STICK_COS;
        }
      }
      if (approach && !recovering && (stick < .05 || pursuing)) {
        const cast = a.cast!, { lunge, driveMove, driveWindow, opening, acquired } = approach;
        const castAge=this.serverTime-cast.start;
        const authoredLunge = cast.move.lunge !== undefined;
        {
          const chosenTarget = acquired ?? (p.target ? this.actors.get(p.target)?.state : undefined);
          // Closed on and steered at where the thrower saw them (lag compensation), as the contact will test.
          const seen = chosenTarget && this.actors.has(chosenTarget.id) ? this.seenBy(a, chosenTarget) : chosenTarget;
          // The dream loop's feel pass (v69, moves.ts STRING_SHOVE): a body the string's last blow is still driving back
          // is closed on where it will be at the contact, not where it is - chased where it was, it was still sliding
          // as the approach eased in, and the next blow landed 8-11 cm further off than the string's own spacing.
          const shoved = chosenTarget ? this.actors.get(chosenTarget.id) : undefined;
          const target = seen && shoved && shoved.knockbackDrag === STRING_DRAG && (shoved.kx || shoved.kz) && cast.slot === 'light'
            ? (() => { const at = this.flightAhead(shoved, Math.max(0, cast.start + cast.move.contacts[Math.min(cast.nextContact, cast.move.contacts.length - 1)] - this.serverTime));
              return { ...seen, x: seen.x + at.x - shoved.state.x, z: seen.z + at.z - shoved.state.z }; })()
            : seen;
          // A move that holds everybody at its blade length stops there, and a
          // charge-in stops at the pushbox: its drive is solved to arrive on
          // the blow, and aimed inside the 1.1 m the separation holds it
          // would shove the target back across the floor before it landed.
          const minimumGap = Math.max(this.gapOf(a, cast.slot, cast.move, !cast.airborne), cast.move.spacing ?? 0,
            cast.move.chargeIn ? PUSH_RADIUS * 2 : 0) + (target ? radiusOf(target) - PLAYER_RADIUS : 0);
          let space = target?.alive ? Math.max(0, Math.hypot(target.x - p.x, target.z - p.z) - minimumGap) : Infinity;
          if (cast.move.style === 'melee') {
            // Sweep the approach against living fighter discs as well as the
            // existing environment capsule sweep below. Never push through an
            // intervening player just to reach the selected target - and with
            // nobody selected, never drive into whoever is in front. This was
            // Taisei's alone; everyone else's lunge ran on into a body with no
            // target to stop it, and the pushbox shoved them back out after.
            for (const other of this.actors.values()) {
              if (other === a || !other.state.alive || Math.abs(other.state.y - p.y) >= 1.5) continue;
              const dx = other.state.x - p.x, dz = other.state.z - p.z;
              const along = dx * cast.direction.x + dz * cast.direction.z;
              const across = dx * cast.direction.z - dz * cast.direction.x;
              // Round 3c (LOCK): in front, not merely in the front half: a
              // body level with the thrower's shoulder is passed, not driven
              // into, and used to stop a locked Yuragi dead 2.9 m short
              // (arcade survival's sides as they were: see inBlowLane).
              if (along > (p.team === undefined && !a.kit ? LANE_FRONT : 0) && Math.abs(across) < minimumGap) {
                space = Math.min(space, Math.max(0, along - Math.sqrt(minimumGap * minimumGap - across * across)));
              }
            }
          }
          // Steer while closing. The direction was taken when the button went
          // down; an opponent who has moved since then is the difference
          // between a fight and two people swinging at where the other one
          // used to be. Only while the swing is still opening, and only a
          // little per tick, so a committed move stays committed.
          if (target?.alive && opening && cast.move.style === 'melee') {
            const dx = target.x - p.x, dz = target.z - p.z, gap = Math.hypot(dx, dz);
            if (gap > 1e-3) {
              const blend = Math.min(1, 7 * dt);
              cast.direction.x += (dx / gap - cast.direction.x) * blend;
              cast.direction.z += (dz / gap - cast.direction.z) * blend;
              const n2 = Math.hypot(cast.direction.x, cast.direction.z) || 1;
              cast.direction.x /= n2; cast.direction.z /= n2;
              p.yaw = Math.atan2(cast.direction.x, cast.direction.z);
            }
          }
          // Close the whole gap by the time the blow lands, rather than
          // travelling at an authored speed for a fixed window and hitting
          // whatever is still out of reach. The authored lunge is the floor,
          // not the ceiling: it is what a move does with nobody in front of
          // it, and the cap is what makes a swing at someone across the room
          // a whiff instead of a hit through four metres of air.
          const nextContact = cast.move.contacts[Math.min(cast.nextContact, cast.move.contacts.length - 1)];
          // This floor is two frames, which lets the last tick before contact
          // demand an enormous speed to close whatever is left. Raising it so
          // the solve has to plan the approach is the right shape of fix and
          // the roster will not take it: measured, an eighth of a second costs
          // taisei's light its two-metre step-in and breaks three other cases,
          // because his wind-up gives the approach 0.13 s to work with in the
          // first place. That is a move-timing problem, not a solver one. The
          // speed ceiling below does what can be done without re-timing moves.
          const untilContact = Math.max(.035, cast.start + nextContact - this.serverTime);
          const reachable = cast.move.close ?? MAX_CLOSE;
          const needed = Number.isFinite(space) && space <= reachable ? space / untilContact : 0;
          // A charge-in drive is solved to arrive on its blow, not floored at
          // the authored lunge (which arrived early and held the charge
          // accent): see CHARGE_DRIVE.
          const authoredSpeed = driveMove && cast.move.chargeIn ? 0
            : lunge * (driveMove && authoredLunge ? Math.min(4, cast.move.contacts[0] / driveWindow) : 1);
          // Eased in and out over the approach, so a step-in is a step rather
          // than a velocity that switches on for a fifth of a second.
          const through = clamp((castAge - (cast.move.contacts[0] - driveWindow)) / Math.max(1e-3, driveWindow), 0, 1);
          // A charge-in drive eases in from a standstill - it follows the
          // slide back, so it must not open on a step - and then holds the
          // speed that arrives on the blow; easing out as well would leave it
          // short of it. Round 3d (PACE): squared, so it leaves the standstill
          // with no speed at all - the slide back ends a tick before it starts,
          // and at a fifth of a second a plain sine opened on a 1 m/s step.
          const shape = driveMove && cast.move.chargeIn ? Math.sin(Math.PI * Math.min(.5, through)) ** 2
            // (A body the string is shoving is closed on at the solve's own speed: eased, the approach fell behind it.)
            : target !== seen ? 1
            : .45 + .55 * Math.sin(Math.PI * Math.min(1, through));
          // The cap belongs on the solve, not on the animator. An authored
          // lunge is a number somebody chose; `needed` is whatever arithmetic
          // says closes the remaining gap by the contact frame, and left
          // unbounded it asked for ninety metres a second.
          const approachSpeed = Math.min(Math.max(authoredSpeed, Math.min(needed, MAX_APPROACH)) * shape, space / dt);
          if (pursuing) {
            // The run along the swing's line is topped up to the step-in, never added to it; across it, it stands.
            const along = vx * cast.direction.x + vz * cast.direction.z, top = Math.max(0, approachSpeed - along);
            vx += cast.direction.x * top; vz += cast.direction.z * top;
            // A fighter chased is held off by the pushbox (separateBodies); a mode's body has none, so the run is held
            // at the swing's own stop instead - where the step-in would have stood - until the blow.
            if (target && !this.actors.has(target.id)) {
              const over = along + top - space / dt;
              if (over > 0) { vx -= cast.direction.x * over; vz -= cast.direction.z * over; }
            }
          } else {
            vx += cast.direction.x * approachSpeed;
            vz += cast.direction.z * approachSpeed;
          }
        }
      }
      // Through its active frames as well as its opening, a swing that has not landed yet keeps turning onto the
      // fighter it is going for at the opening's rate: a blow still looking for them (cast.live) whose line they have
      // stepped off was the near miss. Its reach stays its own (sweep).
      else if (a.cast?.move.style === 'melee' && a.cast.live?.length && !recovering && !a.cast.through) {
        const cast = a.cast, chased = p.target ? this.actors.get(p.target)?.state : undefined;
        if (chased?.alive && this.hostile(p, chased)) {
          const seen = this.seenBy(a, chased), dx = seen.x - p.x, dz = seen.z - p.z, gap = Math.hypot(dx, dz);
          if (gap > 1e-3 && (dx * cast.direction.x + dz * cast.direction.z) / gap >= MELEE_AIM_COS) {
            const blend = Math.min(1, 7 * dt);
            cast.direction.x += (dx / gap - cast.direction.x) * blend;
            cast.direction.z += (dz / gap - cast.direction.z) * blend;
            const n2 = Math.hypot(cast.direction.x, cast.direction.z) || 1;
            cast.direction.x /= n2; cast.direction.z /= n2;
            p.yaw = Math.atan2(cast.direction.x, cast.direction.z);
          }
        }
      }
      // Round 4b (JUMP): an air strike's dive flies its line (airborneOpener),
      // the stick and the approach aside, and leaves a quarter of its way on.
      if (a.cast?.dive && this.serverTime < a.cast.dive.until && !p.grounded) {
        vx = a.cast.dive.x; vz = a.cast.dive.z; a.mx = vx * .25; a.mz = vz * .25;
      }
      const plunge = a.cast?.move.plunge && a.cast.airborne && !a.cast.landed && !p.grounded && !a.reaction ? a.cast : undefined;
      const cut = a.jumping && !p.grounded && a.vy > 0 && !a.reaction && !a.input.jumpHeld && !a.cast?.airborne
        && this.serverTime - a.jumpStartedAt >= JUMP_CUT_AFTER;
      // Round 4b (JUMP): from three times the height. The hang brakes what is
      // left of the climb rather than stopping it dead (a jump leaves the floor at
      // over twenty metres a second), and the drop snaps up to its speed over
      // PLUNGE_SNAP rather than in one tick - and is recorded, for the landing.
      if (plunge) {
        const age = this.serverTime - plunge.start;
        if (age < PLUNGE_HANG) a.vy = a.vy > 0 ? a.vy * Math.exp(-PLUNGE_BRAKE * dt) : 0;
        else { plunge.plungeFrom ??= p.y; a.vy = -plunge.move.plunge! * Math.min(1, (age - PLUNGE_HANG + dt) / PLUNGE_SNAP); }
      }
      // Round 4b (JUMP): an air strike's dive flies its line (airborneOpener), gravity off.
      const dive = a.cast?.dive && this.serverTime < a.cast.dive.until && !p.grounded && !a.reaction ? a.cast.dive : undefined;
      if (dive) a.vy = dive.y;
      // The rising strike stops climbing on its blow, and comes down from there (RISE_SETTLE).
      else if (a.cast?.dive?.rise && !p.grounded && a.vy > RISE_SETTLE) a.vy = RISE_SETTLE;
      // Round 4b (JUMP): an attack thrown on the way up a jump stops the climb,
      // over a few ticks, at AIR_CAST_RISE; a juggle it rides (it is not a jump
      // any more once it rides one: see hit) keeps what the ride gave it.
      else if (!plunge && a.jumping && a.cast?.airborne && !p.grounded && a.vy > AIR_CAST_RISE)
        a.vy = Math.max(AIR_CAST_RISE, a.vy * Math.exp(-AIR_CAST_BRAKE * dt));
      // Round 4b (JUMP): and a body a reaction owns - a jab, a parry - is not
      // climbing on what is left of its jump: only a launch sends anybody up.
      if (a.reaction && a.reaction !== 'launched' && !p.grounded && a.vy > AIR_CAST_RISE) a.vy = AIR_CAST_RISE;
      const fall = plunge || dive ? 0 : !p.grounded && a.reaction === 'launched' ? LAUNCH_GRAVITY
        : a.cast?.airborne && !p.grounded ? AIR_CAST_GRAVITY
        // Round 4b (JUMP): the jump's own arc - a fast rise, a hang, a hard fall.
        : a.jumping && !p.grounded && !a.reaction ? jumpGravity(a.vy, cut) : 1;
      // A launch chase flies its line: it is aimed at where the target will
      // be, and gravity taken off it tick by tick would land it short.
      // Round 4b (JUMP): a cut rise ends on the top of its arc, not through it,
      // so every hop gets the same hang.
      if (!(a.dashChase && this.serverTime < a.dashUntil)) a.vy = cut ? Math.max(0, a.vy - 23 * dt * fall) : a.vy - 23 * dt * fall;
      const delta = { x: (vx + a.kx) * dt, y: a.vy * dt, z: (vz + a.kz) * dt };
      // v70: a launcher's throw runs ahead of its arc and is back on it at the top (moves.ts LAUNCH_LEAD).
      if (a.launchLead > 0) {
        if (a.reaction !== 'launched' || p.grounded) a.launchLead = 0;
        else {
          const before = launchLead(a.launchRun / a.launchSpan); a.launchRun += dt;
          delta.y += a.launchLead * (launchLead(a.launchRun / a.launchSpan) - before);
          if (a.launchRun >= a.launchSpan) a.launchLead = 0;
        }
      }
      // Night net (12 October 2026): the page's copy replays up to forty ticks a snapshot, and the world's controller
      // (depenetrate, unsink, computeColliderMovement) was three quarters of a tick's cost, asked twelve times a tick for
      // bodies that were not going anywhere: the copy stands every remote body where the server last put it (Prediction.sync
      // gives them no input), so a grounded one with nothing moving it asks the controller for a settle on the floor it
      // already stands on. It is answered without the query here. Only on a follower (the page's copy - the server and
      // every local arena step the authority and ask as before), and never for the local body.
      const corrected: CollisionMovement = this.follows && this.collision && ArenaSimulation.restShortcut && p.id !== this.localId && this.atRest(a, vx, vz, delta.y) ? AT_REST : this.collision?.move(p.id, p, delta) ?? delta;
      const { halfX, halfZ } = this.bounds;
      const wantedX = p.x + corrected.x, wantedZ = p.z + corrected.z;
      p.x = clamp(wantedX, -halfX + PLAYER_RADIUS, halfX - PLAYER_RADIUS);
      p.z = clamp(wantedZ, -halfZ + PLAYER_RADIUS, halfZ - PLAYER_RADIUS);
      // Wall splat. A body travelling under its own knockback that the world
      // refuses to move sticks to what stopped it. Measured as the gap between
      // what was asked for and what was granted - by the collider or by the
      // stage bounds, which is the same thing to whoever hit the wall.
      if (a.reaction && a.reaction !== 'splat' && !a.wallBounce && !a.lockSlide && this.serverTime < a.stunUntil) {
        const asked = Math.hypot(delta.x, delta.z);
        const given = Math.hypot(p.x - (wantedX - corrected.x), p.z - (wantedZ - corrected.z));
        const carried = Math.hypot(a.kx, a.kz) >= WALL_SPLAT_SPEED || a.reaction === 'launched';
        if (carried && this.serverTime - a.lastDamageAt < .8 && asked > 0.02 && given < asked * 0.55) {
          a.kx = a.kz = 0;
          a.vy = Math.min(a.vy, 1.4);
          a.reaction = 'splat';
          a.launchSlot = undefined;
          a.stunUntil = Math.max(a.stunUntil, this.serverTime + WALL_SPLAT_STUN);
          // Ground hits: come down onto the floor, a splat is down there, and is kept there no longer than this - and
          // its stay there opens a ledger of its own (ground hits 2).
          a.floorUntil = a.stunUntil + GROUND_HIT_MOST; a.floorHits = a.floorTaken = 0;
          this.action(a, 'splat', Math.max(.05, a.stunUntil - this.serverTime), true);
          this.emit({ kind: 'wall-splat', actorId: p.id, fighter: p.fighter, origin: position(p) });
        }
      }
      if (a.wallBounce) this.wallBounceTick(a, delta, wantedX, wantedZ, corrected); // Round 3e (VARIETY): off the wall, not pinned to it.
      p.y = this.collision ? p.y + corrected.y : Math.max(0, p.y + corrected.y);
      // Round 4b (JUMP): a roof ends the climb (rapierCollision's ceilings): what the world refused of the rise is a
      // bump of the head, not a body pinned under it until its own gravity has taken the rise away.
      if (delta.y > 1e-3 && corrected.y < delta.y * .5 && a.vy > 0) a.vy = 0;
      if(p.y < -4){this.eliminate(a,'water');continue;}
      const wasAirborne = !p.grounded;
      p.grounded = a.vy <= 0 && (corrected.grounded ??
        (!this.collision ? p.y <= 0.03 : corrected.y > delta.y + 0.0001));
      if (p.grounded) {
        a.airJumps = 0; // The ball rooms (SportFeel.airJumps): the double jump comes back on the floor.
        // Round 4b (JUMP): the floor, for the next leap (LEAP_GROUNDED); a full jump's landing takes a beat before the
        // next jump or dash (JUMP_LAND_RECOVERY) - read off the speed it meets the floor at, before it is taken away.
        if (wasAirborne) {
          a.groundedAt = this.serverTime;
          if (a.jumping && -a.vy >= JUMP_LAND_HARD) a.landedUntil = this.serverTime + JUMP_LAND_RECOVERY;
        }
        if (wasAirborne && a.launchSlot === 'ultimate') {
          this.emit({ kind: 'land', actorId: p.id, fighter: p.fighter, slot: a.launchSlot, origin: position(p) });
        }
        // Ground bounce. A finisher that lands on someone already in the air
        // drives them down, and a body driven down bounces once before it
        // stays down. Once: the flag clears either way, so it extends a combo
        // rather than turning the floor into a trampoline.
        const bouncing = wasAirborne && a.bounceOnLand && a.reaction === 'launched' && p.hp > 0;
        a.bounceOnLand = false;
        if (bouncing) {
          a.vy = a.knockKind === 'spike' ? SPIKE_BOUNCE : GROUND_BOUNCE_LIFT; a.launchLead = 0; // Round 4b (COMBAT): a knockdown's spike bounces low
          p.grounded = false;
          a.kx *= .45; a.kz *= .45;
          a.stunUntil = Math.max(a.stunUntil, this.serverTime + .5);
          this.action(a, 'launched', Math.max(.05, a.stunUntil - this.serverTime), true);
          this.emit({ kind: 'ground-bounce', actorId: p.id, fighter: p.fighter, origin: position(p) });
        } else {
          // A launched fighter who reaches the floor is down, not merely
          // stunned. No second 'land' event: that one stays the ultimate's
          // ground impact.
          if (wasAirborne && a.reaction === 'launched' && a.dizzyOnLand) {
            // A string's dizzy that caught it in the air: on its feet, dazed, as on the ground (combos.ts).
            a.reaction = 'stun'; a.stunUntil = this.serverTime + (a.dazeFor || DIZZY_SECONDS); a.dizzyOnLand = false;
            a.kx *= .25; a.kz *= .25;
          } else if (wasAirborne && a.reaction === 'launched' && a.popLand) {
            // Round 4b (COMBAT): a string's pop lands on its feet, reeling, still in the string - not down, and with no
            // getting-up evade for the blow after it to whiff on.
            a.reaction = 'hurt'; a.stunUntil = Math.max(a.stunUntil, this.serverTime + POP_LAND_STUN);
            a.kx *= .25; a.kz *= .25;
          } else if (wasAirborne && a.reaction === 'launched') {
            a.reaction = 'knockdown';
            // An ultimate still pins longer than a heavy: landing adds a floor
            // to the remaining stun rather than replacing it. Round 3e
            // (VARIETY): a throw with an outcome of its own is down for its
            // own time (OUTCOME_DOWN), whatever stun it arrived with.
            a.stunUntil = a.downFor !== undefined && a.launchSlot !== 'ultimate' ? this.serverTime + a.downFor
              : Math.max(a.stunUntil, this.serverTime + KNOCKDOWN_SECONDS);
            a.floorUntil = a.stunUntil + GROUND_HIT_MOST; a.floorHits = a.floorTaken = 0;
            // Round 4b (COMBAT): a slide skids on along the floor (MoveDefinition.knock).
            if (a.knockKind !== 'slide') { a.kx *= .25; a.kz *= .25; }
          }
          a.vy = 0; a.launchSlot = undefined; a.juggleHits = 0; a.jumping = false;a.motionNetworkHold=0;a.launchLead = 0;
          a.downFor = undefined; a.wallBounce = false; a.popLand = false; a.dazeFor = 0; a.knockKind = ''; // Round 3e (VARIETY): the throw is over.
          // Not a chase leaving the floor: its shape starts at nothing, so
          // on its first tick it has not left yet.
          if (!(a.dashChase && this.serverTime < a.dashUntil)) a.dashY = 0;
        }
      }
      // Down and dizzy both end by getting up, and getting up cannot be meatied
      // by a normal: the reaction is the evade (floorDodges), and an ultimate
      // connects through it (ground hits, 8 October 2026).
      if ((a.reaction === 'knockdown' || a.reaction === 'stun' || a.reaction === 'splat') && this.serverTime >= a.stunUntil) {
        a.reaction = 'getup';
        a.stunUntil = this.serverTime + GETUP_SECONDS;
      } else if (a.reaction && a.reaction !== 'launched' && this.serverTime >= a.stunUntil) {
        // Techniques: back on its feet - a light pressed now (or held over from the getting up) is the Wake-up Strike.
        if (a.reaction === 'getup') a.risenAt = this.serverTime;
        a.reaction = null;
      }
      if (a.spinLeft) this.spinTick(a, dt); // Round 3e (VARIETY): a spin-out's turn.
      a.kx *= Math.exp(-a.knockbackDrag * dt); a.kz *= Math.exp(-a.knockbackDrag * dt);
      if (a.cast) {
        const running = a.cast;
        if (aimsAsLetGo(running.move) && running.nextContact === 0) this.trackShot(a, dt); // Round 4b (FMOVES).
        // A fighter who jumped while the swing was still opening is met on its blow (risingStrike).
        if (running.riseOn && !running.dive && p.grounded && running.nextContact === 0) this.risingStrike(a, running);
        this.updateCast(a);
        // A stage that ran its whole course with the next press already
        // waiting hands straight over to the next stage on the same tick.
        // It used to fall to idle for the tick in between - a whiffed stage
        // cannot be cancelled, so a mashed string whose stage missed always
        // showed the idle stance for a frame, and the renderer began blending
        // towards it before the next stage arrived.
        if (!a.cast && running.slot === 'light' && a.attackSlot === 'light' && this.serverTime <= a.attackHold
            && !(a.dashChase && this.serverTime < a.dashUntil) && this.serverTime >= a.stunUntil && !a.reaction
            && this.status === 'active') {
          const outcome = this.cast(a, 'light');
          if (outcome !== 'blocked' && outcome !== 'cooling') { a.attackAt = a.attackHold = -Infinity; this.nextPress(a); }
        }
      }
      if (!a.cast) {
        if (this.serverTime < a.awakenEntryUntil) this.action(a, 'awaken', AWAKENING_ENTRY);
        else if (this.serverTime < a.blockedUntil && !a.reaction) this.action(a, 'guard');
        else if (this.serverTime < a.stunUntil || a.reaction === 'launched') {
          // The clip is the stagger, not the hold: see reactionClip. A stretch
          // over the whole window plays a flinch at half speed.
          const kind = a.reaction ?? 'hurt';
          const hold = Math.max(.05, a.stunUntil - p.actionStarted);
          this.action(a, kind, kind === 'flinch' || kind === 'hurt' ? Math.min(hold, a.reactionClip) : hold);
        }
        else if (this.serverTime < a.dashUntil) this.action(a, 'dash', a.dashSeconds);
        else this.action(a, p.guarding ? 'guard' : !p.grounded ? 'jump' : Math.hypot(vx, vz) > 0.1 ? 'run' : 'idle');
      }
      // Round 5 (PARRY): nor through a blockstun, which is the guard held up by the blow.
      // The ball rooms (SportFeel.boost): a boost spends it, and none comes back meanwhile.
      if (a.boosting && sport) p.stamina = Math.max(0, p.stamina - sport.boostDrain * dt);
      else if (!a.cast && !p.guarding && this.serverTime >= a.dashUntil && this.serverTime >= a.blockedUntil) p.stamina = Math.min(p.maxStamina??100, p.stamina + STAMINA_REGEN * (a.mods?.staminaRecovery??1) * dt);
      if (a.mods?.staminaRegen) p.stamina = Math.min(p.maxStamina??100, p.stamina + a.mods.staminaRegen * dt);
      p.actionTime = p.actionDuration > 0
        ? clamp((this.serverTime - p.actionStarted - (p.actionFrozen ?? 0)) / p.actionDuration, 0, 1) : 0;
    }
    this.separateBodies(dt);
    this.updateProjectiles(dt);
    this.updateAreas();
    this.checkWinner();
  }

  /** The melee approach, if this cast has one and it is in its window: the
   *  drive that closes the last stride before a blow. Read in two places -
   *  by the drive itself, and by the walk-while-casting rule, which hands the
   *  legs back only while the drive is not using them. */
  private approach(a: Actor) {
    const cast = a.cast;
    if (!cast) return null;
    const lunge = cast.move.lunge ?? (cast.move.style === 'melee' ? DEFAULT_MELEE_LUNGE : 0);
    if (lunge <= 0) return null;
    const p = a.state;
    const acquired = cast.lungeTargetId ? this.actors.get(cast.lungeTargetId)?.state
      : cast.externalAim ? this.externalAsState(cast.externalAim) : undefined;
    const castAge = this.serverTime - cast.start;
    if(castAge<(cast.move.lungeDelay??0))return null;
    // An iai draw closes with its own dash (castMotion), and a charge-in does
    // not drive in while it is still sliding back out.
    if (cast.move.dashThrough || castAge < (cast.backstepPlanned ? cast.backstepUntil ?? 0 : 0)) return null;
    // Senpugan holds the extended palm through its live contact frames. If
    // the first contact tick falls just short, finish that step instead of
    // freezing the sphere centimetres outside the target's hurt volume.
    // Keep the same measured reach, committed direction and input override.
    const palmFollowThrough = !!cast.move.palmHold && !cast.airborne && !cast.connected
      && cast.live?.some(contact=>this.serverTime<=contact.until);
    const follow = acquired?.alive && (cast.nextContact < cast.move.contacts.length || palmFollowThrough);
    // A move with no authored lunge only steps in just before contact, so
    // the default drive closes the last stride rather than crossing the
    // arena during a long wind-up.
    const driveMove = drives(p.fighter, cast.move);
    const driveWindow = driveWindowOf(p.fighter, cast.move);
    const opening = castAge - AGE_EPSILON < cast.move.contacts[0];
    if (!((opening || follow) && (!driveMove || castAge - AGE_EPSILON >= cast.move.contacts[0] - driveWindow))) return null;
    return { lunge, driveMove, driveWindow, opening, acquired };
  }

  /** A move's own travel, as a velocity for this tick, or null.
   *
   *  A charge-in thrown with the opponent inside `chargeIn` slides straight
   *  back from them during its early charge: an eased half-sine that covers
   *  exactly the planned distance by `backstepUntil`, so the charge is held at
   *  a distance and the approach that follows drives in onto the blow.
   *
   *  An iai draw (`dashThrough`) dashes for DASH_THROUGH_LEAD before its
   *  contact: through the body it was aimed at, to DASH_THROUGH_PAST beyond
   *  their centre, arriving on the contact tick - the cut is taken along the
   *  line it ran (see sweep). Nobody in reach, it dashes DASH_THROUGH_MISS
   *  ahead. A held stick owns travel: it cancels what is left of either. */
  private castMotion(a: Actor, dt: number, steering: boolean): { x: number; z: number } | null {
    const cast = a.cast!, p = a.state, age = this.serverTime - cast.start;
    if (cast.backstep && cast.backstepPlanned && cast.backstepUntil) {
      if (steering) { cast.backstep = 0; return null; }
      const planned = cast.backstepPlanned, through = Math.min(1, age / cast.backstepUntil);
      const due = planned * (1 - Math.cos(Math.PI * through)) / 2;
      const move = through >= 1 ? cast.backstep : Math.min(cast.backstep, Math.max(0, due - (planned - cast.backstep)));
      cast.backstep = Math.max(0, cast.backstep - move);
      const from = cast.aimId ? this.actors.get(cast.aimId)?.state : undefined;
      let ux = -cast.direction.x, uz = -cast.direction.z;
      if (from?.alive) {
        const dx = p.x - from.x, dz = p.z - from.z, n = Math.hypot(dx, dz);
        if (n > 1e-3) { ux = dx / n; uz = dz / n; }
      }
      return { x: ux * move / dt, z: uz * move / dt };
    }
    const contact = cast.move.contacts[0];
    if (!cast.move.dashThrough || cast.nextContact > 0 || steering) return null;
    if (!cast.through) {
      const q = cast.aimId ? this.actors.get(cast.aimId)?.state : undefined;
      let dx = cast.direction.x, dz = cast.direction.z, length = DASH_THROUGH_MISS;
      if (q?.alive && Math.abs(q.y - p.y) < 1.5) {
        const gx = q.x - p.x, gz = q.z - p.z, gap = Math.hypot(gx, gz);
        if (gap > DASH_THROUGH_SIDE && gap <= DASH_THROUGH_REACH) {
          // Aimed past them on the thrower's right (the side the lock-on
          // camera sits on, (-cos yaw, 0, sin yaw)): the line that passes
          // DASH_THROUGH_SIDE from their centre.
          const ax = gx / gap, az = gz / gap, turn = Math.asin(DASH_THROUGH_SIDE / gap);
          dx = ax * Math.cos(turn) - az * Math.sin(turn); dz = az * Math.cos(turn) + ax * Math.sin(turn);
          // An iai needs somewhere to stop. With a wall or the stage edge
          // behind them it stops in front of them at the pushbox instead, and
          // the cut goes forward into them - and them into the wall.
          const along = Math.sqrt(gap * gap - DASH_THROUGH_SIDE * DASH_THROUGH_SIDE);
          const beyond = along + DASH_THROUGH_PAST + PLAYER_RADIUS, { halfX, halfZ } = this.bounds;
          const end = { x: p.x + dx * beyond, y: p.y, z: p.z + dz * beyond };
          const sight = this.collision?.raycast?.(centre(p), centre(end));
          const clear = Math.abs(end.x) <= halfX - PLAYER_RADIUS && Math.abs(end.z) <= halfZ - PLAYER_RADIUS
            && !(sight && distance(sight, centre(end)) > .1);
          if (clear) length = along + DASH_THROUGH_PAST;
          else { dx = ax; dz = az; length = Math.max(0, gap - PUSH_RADIUS * 2); }
        }
      }
      // It sets off DASH_THROUGH_LEAD before the blow, or earlier for a long
      // one, so it arrives on the contact tick at no more than its top speed.
      if (age < contact - Math.max(DASH_THROUGH_LEAD, length / DASH_THROUGH_MAX_SPEED)) return null;
      const n = Math.hypot(dx, dz) || 1;
      dx /= n; dz /= n;
      cast.direction = { x: dx, y: 0, z: dz };
      p.yaw = Math.atan2(dx, dz);
      cast.through = { from: position(p), to: { x: p.x + dx * length, y: p.y, z: p.z + dz * length } };
    }
    const left = (cast.through.to.x - p.x) * cast.direction.x + (cast.through.to.z - p.z) * cast.direction.z;
    if (left <= 1e-4) return { x: 0, z: 0 };
    const speed = Math.min(DASH_THROUGH_MAX_SPEED, left / Math.max(dt, cast.start + contact - this.serverTime));
    return { x: cast.direction.x * speed, z: cast.direction.z * speed };
  }

  /** An iai dash on its way through: bodies pass through each other until it
   *  has cut, and are separated again from there. */
  private passing(a: Actor) { return !!a.cast?.through && a.cast.nextContact === 0 || this.gone(a); }

  /** The distance a running move holds everybody at (MoveDefinition.spacing). */
  private spacing(a: Actor) { return a.cast?.move.spacing ?? 0; }

  /** Cloudstep, gone: vanished and not yet back (see `blink`). A
   *  body that is not there is passed through, like an iai dash. A client's
   *  copy of somebody else's body carries no cast, so there it is read off
   *  `goneUntil`, or the local fighter would shove off a body the server
   *  lets them run through. */
  private gone(a: Actor) {
    return a.cast ? !!a.cast.blink && !a.cast.blink.to : this.serverTime < (a.goneUntil ?? -Infinity);
  }

  /** Cloudstep (MoveDefinition.teleport), each tick of the cast
   *  before its contacts are looked at. At `vanish` the thrower leaves and
   *  the body it goes for is chosen (teleportTarget); until it is back it
   *  evades, whatever holds the cast's clock. At `appear` it comes back
   *  behind them (reappear), and its approach homes on them for the blow.
   *  A guard held against it turns to meet it - holding guard blocks it from
   *  any side - and a just guard parries it
   *  into the usual vanish; unguarded, the blow lands in the back. */
  private blink(a: Actor, cast: Cast) {
    const move = cast.move.teleport!, p = a.state, age = this.serverTime - cast.start;
    if (age < move.vanish) return;
    if (!cast.blink) {
      cast.blink = { from: position(p), targetId: this.teleportTarget(a, move.reach)?.id };
      a.dashUntil = Math.min(a.dashUntil, this.serverTime);
    }
    const blink = cast.blink;
    if (!blink.to) {
      // Nothing lands on where it was. A few frames past its return as well,
      // so a blow already on its way to that spot does not meet it there.
      const back = this.serverTime + Math.max(0, move.appear - age);
      a.evadeUntil = Math.max(a.evadeUntil, back + .05);
      // A client's copy hears of the return a round trip late and still has
      // the body where it left; it is let through for that long as well.
      a.goneUntil = back + .25;
      if (age < move.appear) return;
      this.reappear(a, cast, blink);
    }
    const q = blink.targetId ? this.actors.get(blink.targetId)?.state : undefined;
    if (q?.alive && q.guarding && (cast.nextContact < cast.move.contacts.length || !!cast.live?.length)) {
      q.yaw = Math.atan2(p.x - q.x, p.z - q.z);
    }
  }

  /** Whom Cloudstep goes for: the lock, while it is alive and
   *  within `reach`, else the nearest body within `reach` inside the chosen
   *  target's cone round the way the press was aimed. Undefined: a blink. */
  private teleportTarget(a: Actor, reach: number): PlayerState | undefined {
    const p = a.state;
    const within = (q: PlayerState) => q.alive && this.hostile(p, q) && distance(p, q) <= reach + radiusOf(q);
    const locked = p.target ? this.actors.get(p.target)?.state : undefined;
    if (locked && within(locked)) return locked;
    let best: PlayerState | undefined, bestGap = Infinity;
    for (const other of this.actors.values()) {
      const q = other.state;
      if (!within(q)) continue;
      const dx = q.x - p.x, dz = q.z - p.z, gap = Math.hypot(dx, dz);
      if (gap > 1e-4 && (Math.sin(p.yaw) * dx + Math.cos(p.yaw) * dz) / gap < CHOSEN_AIM_COS) continue;
      if (gap < bestGap) { bestGap = gap; best = q; }
    }
    return best;
  }

  /** Back from Cloudstep: behind the body it went for, facing
   *  their back and level with them (in the air beside a body in the air,
   *  falling with it), or - with nobody to go to, or nowhere beside them a
   *  body fits - a blink straight ahead. */
  private reappear(a: Actor, cast: Cast, blink: NonNullable<Cast['blink']>) {
    const p = a.state, move = cast.move.teleport!;
    const target = blink.targetId ? this.actors.get(blink.targetId) : undefined, q = target?.state;
    const beside = target && q?.alive ? this.teleportBehind(a, q, blink.from, move.behind, move.near) : undefined;
    const to = beside ?? this.teleportAhead(a, blink.from, move.miss);
    p.x = to.x; p.y = to.y; p.z = to.z;
    a.mx = a.mz = a.kx = a.kz = 0; a.jumping = false;
    if (beside && target && q) {
      const airborne = !q.grounded;
      // v75: falling with it, but climbing with it no faster than an air cast may (moves.ts AIR_CAST_RISE): a body just
      // launched runs ahead of its arc (LAUNCH_LEAD) at near twenty metres a second, and handed that under an air cast's
      // gravity Cloudstep carried its thrower twelve metres up (tests/jumpArc's royale, re-dealt by v75).
      p.grounded = !airborne; a.vy = airborne ? Math.min(target.vy, AIR_CAST_RISE) : 0; cast.airborne = airborne;
      const dx = q.x - p.x, dz = q.z - p.z, n = Math.hypot(dx, dz) || 1;
      cast.direction = { x: dx / n, y: 0, z: dz / n };
      p.yaw = Math.atan2(dx, dz);
      cast.lungeTargetId = cast.aimId = q.id;
    } else {
      // A blink at nobody lands where it lands: the kick is thrown there.
      // Round 7 (WARD ULT): one that goes nowhere (`miss` nothing: Crossmatch
      // with no fighter in his ROOM) has not blinked, and its swing keeps its
      // own approach - in arcade survival, onto the horde body it was aimed at.
      blink.targetId = undefined;
      if (move.miss > 0) cast.move = { ...cast.move, lunge: 0 };
    }
    blink.to = position(to);
  }

  /** Where Cloudstep comes back beside `q`: behind their back
   *  and across them from where it left - the two agree when they were
   *  facing the thrower, and between them it goes half way round - else
   *  across them, else at their back, else to either side, else on the near
   *  side: the first spot a body fits (teleportFits). A body with its back
   *  already turned is gone round rather than stepped up to: a blink that
   *  stops a stride short of where it left reads as nothing at all.
   *  Round 7 (WARD ULT): `near` (MoveDefinition.teleport) - Crossmatch - tries
   *  the near side first, then either side, then across them. */
  private teleportBehind(a: Actor, q: PlayerState, from: Vec3, behind: number, near = false): Vec3 | undefined {
    const bx = -Math.sin(q.yaw), bz = -Math.cos(q.yaw);
    let fx = q.x - from.x, fz = q.z - from.z;
    const n = Math.hypot(fx, fz);
    if (n > 1e-4) { fx /= n; fz /= n; } else { fx = bx; fz = bz; }
    let px = fx, pz = fz;
    if (bx * fx + bz * fz > -.5) { px = bx + fx; pz = bz + fz; const m = Math.hypot(px, pz) || 1; px /= m; pz /= m; }
    const sides = near ? [[-fx, -fz], [fz, -fx], [-fz, fx], [fx, fz]] : [[px, pz], [fx, fz], [bx, bz], [fz, -fx], [-fz, fx], [-fx, -fz]];
    for (const [ux, uz] of sides) {
      const spot = this.teleportFits(a, q, q.id, ux, uz, behind, true);
      if (spot) return spot;
    }
    return undefined;
  }

  /** The whiff: straight ahead along the aim from where it left, as far as
   *  `miss` or as far short of that as a body fits, else where it left. */
  private teleportAhead(a: Actor, from: Vec3, miss: number): Vec3 {
    const p = a.state, ux = Math.sin(p.yaw), uz = Math.cos(p.yaw);
    for (const share of [1, .75, .5, .25]) {
      const spot = this.teleportFits(a, from, p.id, ux, uz, miss * share, false);
      if (spot) return spot;
    }
    return position(from);
  }

  /** `length` along (ux, uz) from `anchor`, swept through the world with the
   *  sim's own capsule and kept inside the stage, as a vanish is; undefined
   *  unless a body fits there: in sight of the anchor, a pushbox clear of
   *  every living body at that height but the thrower and `skip` and,
   *  `beside` a body, at least a pushbox away from it. */
  private teleportFits(a: Actor, anchor: Vec3, skip: string, ux: number, uz: number, length: number, beside: boolean): Vec3 | undefined {
    const p = a.state, { halfX, halfZ } = this.bounds;
    const wanted = { x: ux * length, y: 0, z: uz * length };
    const moved = this.collision?.move(p.id, anchor, wanted) ?? wanted;
    const to = { x: clamp(anchor.x + moved.x, -halfX + PLAYER_RADIUS, halfX - PLAYER_RADIUS), y: anchor.y + (this.collision ? moved.y : 0),
      z: clamp(anchor.z + moved.z, -halfZ + PLAYER_RADIUS, halfZ - PLAYER_RADIUS) };
    if (beside && Math.hypot(to.x - anchor.x, to.z - anchor.z) < PUSH_RADIUS * 2) return undefined;
    const sight = this.collision?.raycast?.(centre(anchor), centre(to));
    if (sight && distance(sight, centre(to)) > .1) return undefined;
    for (const other of this.actors.values()) {
      const o = other.state;
      if (other === a || o.id === skip || !o.alive || Math.abs(o.y - to.y) >= 1.5) continue;
      if (Math.hypot(o.x - to.x, o.z - to.z) < pushOf(o) + PUSH_RADIUS) return undefined;
    }
    return to;
  }

  /** Aim this dash at the body the fighter's own launch sent flying: at where
   *  it will be when the follow-up's blow lands, short of it on the floor
   *  plane by that light's striking gap and level with it in the air, so an
   *  air light pressed on arrival connects. From the ground as well as the
   *  air. Always a forward dash, with a forward dash's evade and stamina. */
  private startChase(a: Actor, chased: Actor, byLight = false) {
    const p = a.state, q = chased.state;
    const light = a.forged ? this.moveOf(a, 'light') : rushMove(p.fighter, 0, !!p.awakened), lead = light.contacts[0];
    const meet = this.flightAhead(chased, CHASE_SECONDS + lead);
    const hx = meet.x - p.x, hz = meet.z - p.z, flat = Math.hypot(hx, hz);
    const along = flat > 1e-3 ? Math.max(0, flat - contactGap(p.fighter, 'light', light, false)) / flat : 0;
    // An air light falls at AIR_CAST_GRAVITY while it winds up; arrive that
    // much above them and the blow lands level. A body still on the floor is
    // chased along the floor.
    const airborne = !q.grounded || chased.vy > 0;
    const to = { x: p.x + hx * along, y: airborne ? meet.y + .5 * 23 * AIR_CAST_GRAVITY * lead * lead : p.y, z: p.z + hz * along };
    const dx = to.x - p.x, dy = to.y - p.y, dz = to.z - p.z, span = Math.hypot(dx, dy, dz);
    if (span > 1e-3) { a.dashX = dx / span; a.dashY = dy / span; a.dashZ = dz / span; }
    a.dashKind = 'forward'; a.dashSeconds = CHASE_SECONDS;
    a.dashUntil = this.serverTime + CHASE_SECONDS; a.evadeUntil = this.serverTime + DASH_EVADE;
    a.dashSpeed = Math.min(CHASE_MAX_SPEED, span * CHASE_UNIT);
    a.dashChase = true; a.chaseUntil = a.lightChaseUntil = -Infinity;
    // The chase cancels the launcher's recovery, so the follow-up light is a
    // chained normal: it comes out on arrival, not when the finisher's own
    // cooldown (its whole duration) would have let a fresh jab out.
    p.cooldowns.light = Math.min(p.cooldowns.light, this.serverTime);
    // A follow-up pressed with the chase itself waits for it to land.
    if (a.attackHold >= this.serverTime) a.attackHold = Math.max(a.attackHold, a.dashUntil + INPUT_BUFFER);
    if (flat > 1e-3) p.yaw = Math.atan2(hx, hz);
    const travel = a.dashSpeed / CHASE_UNIT;
    // `slot: 'light'` when the light button threw it rather than the dash.
    this.emit({ kind: 'chase', actorId: p.id, targetId: q.id, fighter: p.fighter, origin: position(p),
      slot: byLight ? 'light' : undefined,
      endpoint: { x: p.x + a.dashX * travel, y: p.y + a.dashY * travel, z: p.z + a.dashZ * travel } });
  }

  /** The body a light pressed now would chase: inside LIGHT_CHASE_WINDOW of
   *  this fighter's own finisher or heavy launching it, still off the floor
   *  or on the way up, alive, and inside CHASE_RANGE. */
  private chaseByLight(a: Actor): Actor | undefined {
    if (this.serverTime > a.lightChaseUntil || !a.chaseTargetId) return undefined;
    const chased = this.actors.get(a.chaseTargetId), q = chased?.state;
    if (!chased || !q?.alive || (q.grounded && chased.vy <= 0) || distance(a.state, q) > CHASE_RANGE) return undefined;
    // Lock combat: the knockaway reads before the dash after it (LOCK_CHASE_HOLD, counted after the impact freeze).
    if (this.locking(a) && this.serverTime < a.lightChaseUntil - LIGHT_CHASE_WINDOW + LOCK_CHASE_HOLD) return undefined;
    // Round 4b (COMBAT): the chase is a timed light - pressed at a pace, or from the fighter's own jump (Jump + Light) -
    // never a mashed one, which waits under them (holdLight). A survival boss is chased as it always was.
    if (!chased.kit && !a.attackPaced && !(a.jumping && !a.state.grounded)) return undefined;
    // Somebody else standing in front, inside the jab's reach, gets the jab.
    if (this.hittableInFront(a, this.rushStageFor(a), q.id)) return undefined;
    return chased;
  }

  /** Lock combat (lockCombat.ts), the dash-in: the body a light pressed now dashes in at - one that would open
   *  a string on the floor, with its target (the one locked, else the nearest in front) out of the jab's reach but inside
   *  LOCK_DASH_IN. The light chase's own dash takes it there (startChase) and the press comes out on arrival. */
  private dashIn(a: Actor): Actor | undefined {
    const p = a.state;
    // Techniques: a light inside the fighter's own dash is the Dash Strike, not a dash-in.
    if (this.serverTime < a.dashUntil && !a.dashChase) return undefined;
    if (!this.locking(a) || a.cast || a.dashChase || !p.grounded || this.serverTime <= a.rushUntil || this.rushStageFor(a) !== 0) return undefined;
    const locked = p.target ? this.actors.get(p.target) : undefined;
    const q = locked?.state.alive ? locked.state : this.nearestInFront(p, LOCK_DASH_IN, Math.cos(1.2));
    const target = q ? this.actors.get(q.id) : undefined;
    const gap = q ? Math.hypot(q.x - p.x, q.z - p.z) : Infinity;
    if (!target || !q || q.team !== undefined && q.team === p.team || gap <= LOCK_DASH_FROM || gap > LOCK_DASH_IN) return undefined;
    return this.hittableInFront(a, 0, undefined, true) ? undefined : target;
  }

  /** Whether a light thrown now as `stage` has a body to land on in front of
   *  it: inside its reach on the floor, level enough for a blow from the
   *  chest to touch, and inside the melee aim cone. `except` is left out. */
  // (`externals`: and the mode's own bodies - the co-op horde's grunts, Rift War's armies - for lock combat's dash-in, which
  // dashed through a wall of grunts at an elite eight metres off, and filled co-op's rift bars slower: all_modes.mts.)
  private hittableInFront(a: Actor, stage: number, except?: string, externals = false): boolean {
    const p = a.state, m = a.forged && stage === 0 ? this.moveOf(a, 'light') : rushMove(p.fighter, stage, !!p.awakened);
    // Aimed the way the press was, as cast() will throw it.
    const yaw = a.attackYaw ?? a.input.yaw;
    const reach = meleeReach(p.fighter, 'light', m, p.grounded);
    const across = m.radius + PLAYER_RADIUS;
    for (const other of this.actors.values()) {
      const q = other.state;
      if (q.id === p.id || q.id === except || !q.alive || Math.abs(q.y - p.y) > across) continue;
      const dx = q.x - p.x, dz = q.z - p.z, gap = Math.hypot(dx, dz);
      if (gap > Math.min(reach, m.range + across) || gap < 1e-4) continue;
      if ((Math.sin(yaw) * dx + Math.cos(yaw) * dz) / gap >= MELEE_AIM_COS) return true;
    }
    if (externals && this.external) {
      const near = Math.min(reach, m.range + across), n = this.external.query(p, p, near + 1, this.nearby);
      for (let i = 0; i < n; i++) {
        const body = this.nearby[i];
        if (this.external.hostile?.(p.id, body) === false || Math.abs(body.y - p.y) > across + 1) continue;
        const dx = body.x - p.x, dz = body.z - p.z, gap = Math.hypot(dx, dz);
        if (gap > near + body.radius || gap < 1e-4) continue;
        if ((Math.sin(yaw) * dx + Math.cos(yaw) * dz) / gap >= MELEE_AIM_COS) return true;
      }
    }
    return false;
  }

  /** A light that must not come out yet. Inside the light-chase window it is
   *  the chase, which the dash branch starts as soon as the move it follows
   *  lets go (and it arrives with this press still held). Otherwise, a light
   *  that would open a fresh string on the ground while the body this
   *  fighter launched is still up in the air within LAUNCH_HOLD_RANGE would
   *  swing at nothing under them: it waits for them to come down, or for its
   *  buffer to run out. */
  private holdLight(a: Actor, stage: number): boolean {
    if (this.chaseByLight(a) || this.dashIn(a)) return true;
    const p = a.state;
    if (stage > 0 || !p.grounded || !a.chaseTargetId) return false;
    const launched = this.actors.get(a.chaseTargetId), q = launched?.state;
    return !!launched && !!q?.alive && !q.grounded && launched.reaction === 'launched'
      && Math.hypot(q.x - p.x, q.z - p.z) <= LAUNCH_HOLD_RANGE
      // Not while somebody else stands in front to land it on.
      && !this.hittableInFront(a, stage, q.id);
  }

  /** Where a body the reaction owns will be `seconds` from now: its knockback
   *  bleeding off under its own drag, its fall under the gravity it falls at,
   *  and nothing at all while it is still held in an impact freeze. The same
   *  integration the step applies, in closed form. */
  private flightAhead(t: Actor, seconds: number): Vec3 {
    const q = t.state;
    const moving = Math.max(0, seconds - Math.max(0, t.hitstopUntil - this.serverTime));
    const carry = t.knockbackDrag > 0 ? (1 - Math.exp(-t.knockbackDrag * moving)) / t.knockbackDrag : moving;
    const { halfX, halfZ } = this.bounds;
    const g = 23 * (t.reaction === 'launched' ? LAUNCH_GRAVITY : 1);
    return {
      x: clamp(q.x + t.kx * carry, -halfX + PLAYER_RADIUS, halfX - PLAYER_RADIUS),
      // (v70: and a launcher's throw where it runs ahead of the arc: moves.ts LAUNCH_LEAD.)
      y: q.grounded && t.vy <= 0 ? q.y : Math.max(0, q.y + t.vy * moving - .5 * g * moving * moving + this.leadAhead(t, moving)),
      z: clamp(q.z + t.kz * carry, -halfZ + PLAYER_RADIUS, halfZ - PLAYER_RADIUS),
    };
  }

  /** The speed the run will hand back along the dash axis: the run speed in
   *  that direction, scaled by how much of the stick is still pointing the
   *  way the dash went. A released stick hands back nothing, so the dash
   *  still decelerates; a backdash hands back the backpedal, not the sprint. */
  private dashExit(a: Actor, input: PlayerInput) {
    const length = Math.hypot(input.moveX, input.moveZ);
    if (length < 1e-4) return 0;
    const along = clamp((input.moveX * a.dashX + input.moveZ * a.dashZ) / length, 0, 1);
    const p = a.state, sport = this.assist?.sport;
    // (The ball rooms: the run, or the boost the dash is handing over to.)
    const run = (sport ? a.boosting ? sport.boost : sport.run : 7.5) * (p.awakened ? AWAKENED_SPEED : 1);
    return Math.min(a.dashSpeed, run) * along;
  }

  /** Round 4b (JUMP): a jump takes the run with it. What a fighter leaves the
   *  floor with is multiplied by their jump's leap (jumpArc) as far as the stick
   *  still points along it: a running jump covers JUMP_SCALE times the old one's
   *  floor, a standing one goes straight up, and a stick let go of on the takeoff
   *  leaps nowhere. The air keeps it while the stick does (`travel`). Not a jump
   *  taken again off a landing - inside LEAP_GROUNDED, or on a stale packet: that
   *  one keeps no more than a run's worth of what it landed with, or the leap was
   *  multiplied again on every hop of a chain. Whether it leapt. */
  private leap(a: Actor, input: PlayerInput, stale: boolean): boolean {
    const p = a.state, speed = Math.hypot(a.mx, a.mz), stick = Math.hypot(input.moveX, input.moveZ), sport = this.assist?.sport;
    if (stale || this.serverTime - a.groundedAt < LEAP_GROUNDED) {
      const run = (sport ? a.boosting ? sport.boost : sport.run : 7.5) * (p.awakened ? AWAKENED_SPEED : 1) * (a.mods?.speed ?? 1);
      if (speed > run) { a.mx *= run / speed; a.mz *= run / speed; }
      return false;
    }
    if (speed < 1e-3 || stick < .05) return false;
    const along = clamp((input.moveX * a.mx + input.moveZ * a.mz) / (stick * speed), 0, 1);
    // (The ball rooms: a sport's run, boosted, multiplied by the leap would fly a body across half the pitch: it carries
    // at no more than SportFeel.leap.)
    const k = Math.min(1 + (jumpArc(p.fighter).leap - 1) * along, sport ? Math.max(1, sport.leap / speed) : Infinity);
    a.mx *= k; a.mz *= k;
    return k > 1;
  }

  /** The rising strike (RISE_FROM): a melee move thrown from the floor at a fighter in the air over the thrower
   *  flies up to meet them on its blow - level with where they will be then, as the thrower sees them (lag
   *  compensation), and on the floor plane to the move's own striking distance - on the air strike's line (`dive`). */
  private risingStrike(a: Actor, cast: Cast) {
    const target = cast.riseOn ? this.actors.get(cast.riseOn) : undefined, p = a.state;
    if (!target?.state.alive || target.state.grounded || cast.move.dashThrough || cast.move.teleport || cast.move.plunge) return;
    // Only at somebody the move would reach standing on the floor under them (its own reach and step-in), the time
    // left to its blow at least two ticks.
    const flat = Math.hypot(target.state.x - p.x, target.state.z - p.z);
    if (flat > this.reachOf(a, cast.slot, cast.move) + (cast.move.close ?? MAX_CLOSE) + radiusOf(target.state) - PLAYER_RADIUS) return;
    const lead = Math.max(2 / 60, cast.start + (cast.move.contacts[0] ?? .2) - this.serverTime);
    const meet = this.aheadOf(a, target, lead);
    const rise = Math.min(meet.y - p.y, RISE_REACH, RISE_SPEED * lead);
    if (rise < RISE_FROM) return;
    const hx = meet.x - p.x, hz = meet.z - p.z, span = Math.hypot(hx, hz);
    const along = span > 1e-3 ? Math.max(0, span - this.gapOf(a, cast.slot, cast.move, false)) / span : 0;
    let vx = hx * along / lead, vz = hz * along / lead;
    const across = Math.hypot(vx, vz), most = Math.min(MAX_APPROACH * 1.5, RISE_SPEED);
    if (across > most) { vx *= most / across; vz *= most / across; }
    if (span > 1e-3) { p.yaw = Math.atan2(hx, hz); cast.direction = { x: hx / span, y: 0, z: hz / span }; }
    cast.dive = { x: vx, y: rise / lead, z: vz, until: this.serverTime + lead, rise: true };
    cast.airborne = true;
    p.grounded = false; a.jumping = false;
  }

  /** Where `target` will be `seconds` from now as `a` will see it then: its flight carried on (a jump's own arc,
   *  its run and its knockback), less the time `a` sees it late by (lag compensation) - which, past now, is where it
   *  was. */
  private aheadOf(a: Actor, target: Actor, seconds: number): Vec3 {
    const ahead = seconds - (this.rewind > 0 && a.viewLag ? a.viewLag : 0), q = target.state;
    if (ahead <= 0) {
      const lag = a.viewLag;
      a.viewLag = -ahead;
      const seen = this.seenBy(a, q);
      a.viewLag = lag;
      return position(seen);
    }
    const { halfX, halfZ } = this.bounds;
    return {
      x: clamp(q.x + (target.mx + target.kx) * ahead, -halfX + PLAYER_RADIUS, halfX - PLAYER_RADIUS),
      y: this.heightAhead(target, ahead),
      z: clamp(q.z + (target.mz + target.kz) * ahead, -halfZ + PLAYER_RADIUS, halfZ - PLAYER_RADIUS),
    };
  }

  /** v70: how much higher a launcher's thrown body will be `seconds` of flight from now than its arc alone says (moves.ts
   *  LAUNCH_LEAD; nought on any other flight). */
  private leadAhead(t: Actor, seconds: number) {
    if (!(t.launchLead > 0) || t.reaction !== 'launched') return 0;
    return t.launchLead * (launchLead((t.launchRun + seconds) / t.launchSpan) - launchLead(t.launchRun / t.launchSpan));
  }

  /** How high `target`'s feet will be `seconds` from now: on the floor where it stands, else on its flight - a jump's
   *  own arc (rise, hang and fall: jumpGravity), a launch's gravity, or a plain fall - down to the floor at 0. */
  private heightAhead(target: Actor, seconds: number) {
    const q = target.state;
    let y = q.y, vy = target.vy;
    if (q.grounded && vy <= 0) return y;
    const jumping = target.jumping && !target.reaction, g = 23 * (target.reaction === 'launched' ? LAUNCH_GRAVITY : 1), dt = 1 / 60;
    let run = 0;
    for (let t = 0; t < seconds && y >= 0; t += dt) {
      vy -= g * dt * (jumping ? jumpGravity(vy, false) : 1);
      y += vy * dt; run += dt;
    }
    return Math.max(0, y + this.leadAhead(target, run));
  }

  /** Round 4b (JUMP): an attack thrown off the floor, from the new heights. It
   *  takes no more than a run's worth of a leap into the blow. The air strike
   *  (airHeavy) dives - at the body it is thrown at, to meet it on the blow, or at
   *  nobody down and on along its facing - and an air string's opener thrown at a
   *  body in the air inside its reach is aimed to be level with it on the blow.
   *  Anything else keeps the old air game: its climb comes off at AIR_CAST_RISE
   *  (step) and it falls at AIR_CAST_GRAVITY. */
  private airborneOpener(a: Actor, cast: Cast) {
    const p = a.state;
    const run = 7.5 * (p.awakened ? AWAKENED_SPEED : 1) * (a.mods?.speed ?? 1), carried = Math.hypot(a.mx, a.mz);
    if (carried > run) { a.mx *= run / carried; a.mz *= run / carried; }
    if (a.kit) return;
    const lead = Math.max(1 / 60, cast.move.contacts[0] ?? .2);
    if (cast.branch === 'airHeavy') {
      const q = this.airAim(a, AIR_STRIKE_REACH, true);
      const ext = !q && this.assist?.airExternal && a.chosenExternal ? this.external?.locate(a.chosenExternal) : undefined;
      let vx: number, vy: number, vz: number;
      if (!q && ext && Math.hypot(ext.x - p.x, ext.z - p.z) <= AIR_STRIKE_REACH && Math.abs(ext.y - p.y) < 8) {
        // At the ball: the blow (a body's height up) comes level with its middle.
        const hx = ext.x - p.x, hz = ext.z - p.z, flat = Math.hypot(hx, hz), mid = ext.y + ext.height * .55 - 1.1;
        const along = flat > 1e-3 ? Math.max(0, flat - this.gapOf(a, 'heavy', cast.move, false)) / flat : 0;
        vx = hx * along / lead; vz = hz * along / lead; vy = Math.max(-AIR_STRIKE_BLIND[1], Math.min(AIR_CAST_RISE, (mid - p.y) / lead));
        const speed = Math.hypot(vx, vy, vz);
        if (speed > AIR_STRIKE_SPEED) { vx *= AIR_STRIKE_SPEED / speed; vy *= AIR_STRIKE_SPEED / speed; vz *= AIR_STRIKE_SPEED / speed; }
        if (flat > 1e-3) { p.yaw = Math.atan2(hx, hz); cast.direction = { x: hx / flat, y: 0, z: hz / flat }; }
      } else if (q) {
        const meet = q.state.grounded && q.vy <= 0 ? position(q.state) : this.flightAhead(q, lead);
        const hx = meet.x - p.x, hz = meet.z - p.z, flat = Math.hypot(hx, hz);
        const along = flat > 1e-3 ? Math.max(0, flat - this.gapOf(a, 'heavy', cast.move, false)) / flat : 0;
        // Level with them, a little over: the blow comes down onto the body.
        vx = hx * along / lead; vz = hz * along / lead; vy = Math.min(AIR_CAST_RISE, (meet.y + .4 - p.y) / lead);
        const speed = Math.hypot(vx, vy, vz);
        if (speed > AIR_STRIKE_SPEED) { vx *= AIR_STRIKE_SPEED / speed; vy *= AIR_STRIKE_SPEED / speed; vz *= AIR_STRIKE_SPEED / speed; }
        if (flat > 1e-3) { p.yaw = Math.atan2(hx, hz); cast.direction = { x: hx / flat, y: 0, z: hz / flat }; }
      } else {
        vx = cast.direction.x * AIR_STRIKE_BLIND[0]; vz = cast.direction.z * AIR_STRIKE_BLIND[0]; vy = -AIR_STRIKE_BLIND[1];
      }
      cast.dive = { x: vx, y: vy, z: vz, until: cast.start + lead };
      return;
    }
    if (cast.slot !== 'light' || cast.stage !== 0) return;
    const q = this.airAim(a, meleeReach(p.fighter, 'light', cast.move, false) + (cast.move.close ?? MAX_CLOSE), false);
    if (!q || (q.state.grounded && q.vy <= 0)) return;
    const meet = this.flightAhead(q, lead);
    a.vy = clamp((meet.y - p.y) / lead + .5 * 23 * AIR_CAST_GRAVITY * lead, -AIR_HOME_DROP, AIR_CAST_RISE);
  }

  /** Round 4b (JUMP): whom an attack thrown off the floor goes for: the Tab lock
   *  if it holds one (and nobody else if that is out of reach), else the body the
   *  player has picked, else the nearest in front - inside `reach` on the floor
   *  plane, alive and hostile, and with `below`, not over the thrower's head. */
  private airAim(a: Actor, reach: number, below: boolean): Actor | undefined {
    const p = a.state;
    const fits = (q?: PlayerState) => !!q && q.id !== p.id && q.alive && this.hostile(p, q) && (!below || q.y <= p.y + .5)
      && Math.abs(q.y - p.y) < 8 && Math.hypot(q.x - p.x, q.z - p.z) <= reach;
    const lock = this.hardLock(a);
    if (lock) return fits(lock) ? this.actors.get(lock.id) : undefined;
    const picked = p.target ? this.actors.get(p.target) : undefined;
    if (picked && fits(picked.state)) return picked;
    let best: Actor | undefined, nearest = Infinity;
    for (const other of this.actors.values()) {
      const q = other.state;
      if (!fits(q)) continue;
      const dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz);
      if (d > 1e-3 && (Math.sin(p.yaw) * dx + Math.cos(p.yaw) * dz) / d < MELEE_AIM_COS) continue;
      if (d < nearest) { nearest = d; best = other; }
    }
    return best;
  }

  /** Size a ground dash around the run it interrupts. Called once, on the
   *  tick the dash begins, before the run velocity is clobbered: it takes the
   *  along-axis speed the fighter arrived with as the floor under the rise,
   *  estimates the floor under the fall from the stick as it is now, and
   *  scales the plateau so the tick-sampled integral of the burst - the
   *  ground the dash covers, which every bot dodge and spacing read is
   *  calibrated on - is exactly what the bare trapezoid would have covered.
   *  From a standing start both floors are zero and nothing changes. */
  private shapeGroundDash(a: Actor, input: PlayerInput, dt: number) {
    a.dashEntry = Math.max(0, a.mx * a.dashX + a.mz * a.dashZ);
    const exit = this.dashExit(a, input);
    const samples: [number, number][] = [];
    let base = 0;
    for (let k = 0; k * dt < a.dashSeconds; k++) {
      const through = k * dt / a.dashSeconds;
      const sample = a.dashSpeed * dashShape(through);
      base += sample;
      samples.push([sample, through < DASH_RISE ? a.dashEntry : through > 1 - DASH_FALL ? exit : 0]);
    }
    // Every tick the floors do not own is scaled by one factor, solved so the
    // sum is the bare trapezoid's. Scaling the plateau alone left a bump
    // where the fall began: the first fall tick was still at full height
    // while the plateau had been lowered to pay for the floors, 30.6 to 33.1
    // and back down. With no floors the factor is one and nothing changes.
    const sum = (scale: number) => samples.reduce((total, [sample, floor]) => total + Math.max(sample * scale, floor), 0);
    let low = 0, high = 1;
    if (sum(1) > base + 1e-9) for (let i = 0; i < 24; i++) { const mid = (low + high) / 2; if (sum(mid) > base) high = mid; else low = mid; }
    else high = 1;
    a.dashPlateau = sum(1) > base + 1e-9 ? (low + high) / 2 : 1;
  }

  /** Two beams pointed at each other. Their beam does not have to have fired
   *  yet - a beam that is nearly out is a beam, and waiting for both contacts
   *  to land on the same tick would mean this almost never happened. */
  private headOn(a: Actor, target: Actor) {
    const other = target.cast;
    if (!other || other.move.style !== 'beam') return false;
    if (other.cine) return false; // Round 3d (ULTS): a beam ultimate's cinematic is nobody else's to cancel.
    if (this.serverTime - other.start < other.move.contacts[0] - .5) return false;
    return this.facing(target.state, a.state) > .5;
  }

  /** How squarely `p` is turned toward `q`, as a dot product. */
  private facing(p: PlayerState, q: PlayerState) {
    const dx = q.x - p.x, dz = q.z - p.z, n = Math.hypot(dx, dz) || 1;
    return (Math.sin(p.yaw) * dx + Math.cos(p.yaw) * dz) / n;
  }

  /** Two beams meeting head-on annihilate each other. Both casts stop where
   *  they are, neither one reaches anybody, and the light goes off between
   *  them - the same answer two projectiles already give each other. */
  private cancelBeams(a: Actor, b: Actor, midpoint: Vec3) {
    const castA = a.cast, castB = b.cast;
    if (!castA || !castB) return;
    a.cast = b.cast = null;
    for (const actor of [a, b]) {
      actor.state.cooldowns[actor === a ? castA.slot : castB.slot] =
        Math.max(actor.state.cooldowns[actor === a ? castA.slot : castB.slot] ?? 0, this.serverTime + .35);
      this.action(actor, 'idle');
    }
    this.emit({ kind: 'projectile-clash', actorId: a.state.id, targetId: b.state.id,
      fighter: a.state.fighter, slot: castA.slot, origin: position(midpoint), endpoint: position(midpoint),
      damage: Math.round(castA.move.damage + castB.move.damage) });
  }

  /** Round 4b (FMOVES): the body a shot aimed as it is let go is thrown at (MoveDefinition.aimOnRelease) - the
   *  thrower's target, or in arcade survival the horde body it turned to - where its middle is, and how it is moving
   *  along the floor; undefined when there is none in reach. */
  private shotTarget(a: Actor, cast: Cast): { at: Vec3; vx: number; vz: number; actor?: Actor } | undefined {
    const p = a.state, reach = cast.move.range + 2;
    const q = p.target ? this.actors.get(p.target) : undefined;
    if (q?.state.alive && this.hostile(p, q.state) && distance(p, q.state) <= reach) return { at: centreOf(q.state), vx: q.mx + q.kx, vz: q.mz + q.kz, actor: q };
    const body = cast.externalAim ? this.external?.locate(cast.externalAim) : undefined;
    if (body && Math.hypot(body.x - p.x, body.z - p.z) <= reach) return { at: { x: body.x, y: body.y + body.height * .55, z: body.z }, vx: 0, vz: 0 };
    return undefined;
  }

  /** Round 4b (FMOVES): through a shot's wind-up its thrower turns after the body it is thrown at (SHOT_TRACK). */
  private trackShot(a: Actor, dt: number) {
    const cast = a.cast!, aim = this.shotTarget(a, cast);
    if (!aim) return;
    const p = a.state, want = Math.atan2(aim.at.x - p.x, aim.at.z - p.z);
    const turn = ((want - p.yaw + Math.PI) % TAU + TAU) % TAU - Math.PI, most = SHOT_TRACK * dt;
    p.yaw += clamp(turn, -most, most);
    cast.direction = { x: Math.sin(p.yaw), y: 0, z: Math.cos(p.yaw) };
  }

  /** Round 4b (FMOVES): a shot let go at where the body it is thrown at will be when it arrives (SHOT_LEAD), within
   *  SHOT_CONE of the thrower's facing: the shot's line and its end - its range along that line, short at the first
   *  wall - are set here, on the release, and the release says so (the renderer flies it there). */
  private aimShot(a: Actor, cast: Cast, from: Vec3) {
    const aim = this.shotTarget(a, cast);
    if (!aim) return;
    const p = a.state, m = cast.move, speed = m.speed ?? 20;
    // Led on the floor plane by their run (SHOT_LEAD at most), and up and down by their flight - a jump's own arc -
    // so a shot at somebody in the air goes where they will be on it, not where they were leaving.
    let lx = 0, lz = 0, ly = 0;
    for (let pass = 0; pass < 3; pass++) {
      const t = Math.hypot(aim.at.x + lx - from.x, aim.at.y + ly - from.y, aim.at.z + lz - from.z) / speed;
      lx = aim.vx * t; lz = aim.vz * t;
      const lead = Math.hypot(lx, lz);
      if (lead > SHOT_LEAD) { lx *= SHOT_LEAD / lead; lz *= SHOT_LEAD / lead; }
      ly = aim.actor ? this.heightAhead(aim.actor, t) - aim.actor.state.y : 0;
    }
    let dx = aim.at.x + lx - from.x, dy = aim.at.y + ly - from.y, dz = aim.at.z + lz - from.z;
    // Never further off the facing than the cone: turned back toward it, about the vertical.
    const yaw = Math.atan2(dx, dz), off = ((yaw - p.yaw + Math.PI) % TAU + TAU) % TAU - Math.PI;
    if (Math.abs(off) > SHOT_CONE) {
      const flat = Math.hypot(dx, dz), turned = p.yaw + Math.sign(off) * SHOT_CONE;
      dx = Math.sin(turned) * flat; dz = Math.cos(turned) * flat;
    }
    const span = Math.hypot(dx, dy, dz);
    if (span < 1e-3) return;
    const dir = { x: dx / span, y: dy / span, z: dz / span };
    const end = { x: from.x + dir.x * m.range, y: from.y + dir.y * m.range, z: from.z + dir.z * m.range };
    cast.endpoint = this.collision?.raycast?.(from, end) ?? end;
    const flat = Math.hypot(dir.x, dir.z);
    if (flat > 1e-3) { p.yaw = Math.atan2(dir.x, dir.z); cast.direction = { x: dir.x / flat, y: 0, z: dir.z / flat }; }
  }

  /** Round 8 (ULT AIM): what a bomb is thrown at - as a shot is (shotTarget) - and the point its blast is set off at on
   *  it: its middle, or that height over the floor under it while it is off the floor - a bomb thrown at a body in the
   *  air comes down on the ground under it, where its ring is drawn, rather than going off in the air over everyone. */
  private bombTarget(a: Actor, cast: Cast): { at: Vec3; vx: number; vz: number } | undefined {
    const aim = this.shotTarget(a, cast), q = a.state.target ? this.actors.get(a.state.target)?.state : undefined;
    if (aim && q && !q.grounded && aim.at.x === q.x && aim.at.z === q.z) aim.at = { x: q.x, y: this.floorUnder(q) + (aim.at.y - q.y), z: q.z };
    return aim;
  }
  /** The floor under a body off it: the first fixed surface straight down, else the floor of an arena with no world. */
  private floorUnder(q: PlayerState) {
    if (!this.collision?.raycast) return 0;
    const c = centreOf(q), below = this.collision.raycast(c, { x: c.x, y: c.y - 60, z: c.z });
    return below.y > c.y - 59.9 ? below.y : q.y;
  }

  /** Round 8 (ULT AIM): a bomb let go at where the body it is thrown at will be when it comes down (bombAim.ts: its run
   *  carried over the flight, in part and a few metres at most), inside the move's range and short at the first wall, its
   *  thrower turned to it. Nobody to throw it at: it comes down where it was aimed at the press. */
  private aimBomb(a: Actor, cast: Cast, from: Vec3) {
    const aim = this.bombTarget(a, cast);
    if (!aim) return;
    const p = a.state, m = cast.move, end = { x: 0, y: 0, z: 0 };
    bombLead(from, aim.at, aim.vx, aim.vz, m.speed ?? 20, end);
    inRange(end, from, m.range);
    cast.endpoint = this.collision?.raycast?.(from, end) ?? end;
    const dx = end.x - p.x, dz = end.z - p.z, flat = Math.hypot(dx, dz);
    if (flat > 1e-3) { p.yaw = Math.atan2(dx, dz); cast.direction = { x: dx / flat, y: 0, z: dz / flat }; }
  }

  /** Round 8 (ULT AIM): a bomb aimed as it is let go, in flight, each tick until BOMB_COMMIT before it lands: its blast
   *  point drawn after where the body it was thrown at will be when it comes down, BOMB_HOME metres a second at the
   *  most and no further than BOMB_DRIFT from where it was thrown (bombAim.ts homeStep), inside its range of where it
   *  was let go, and short at the first wall between the two. Only `end` moves: the flight keeps its start, its clock
   *  and its length in time. */
  private homeBomb(shot: Projectile, dt: number) {
    const q = shot.aimId ? this.actors.get(shot.aimId) : undefined, thrower = this.actors.get(shot.actorId)?.state;
    const left = shot.startAt + shot.duration - this.serverTime;
    if (!q?.state.alive || thrower && !this.hostile(thrower, q.state) || left <= BOMB_COMMIT || dt <= 0) return;
    homeStep(shot.end, homeWant(centreOf(q.state), q.mx + q.kx, q.mz + q.kz, left, { x: 0, z: 0 }), BOMB_HOME, dt, shot.aimed!);
    inRange(shot.end, shot.start, shot.move.range);
    const wall = this.collision?.raycast?.(shot.start, shot.end);
    if (wall && Math.hypot(wall.x - shot.end.x, wall.z - shot.end.z) > .01) { shot.end.x = wall.x; shot.end.z = wall.z; }
  }

  private updateCast(a: Actor) {
    const cast = a.cast!;
    if (cast.move.teleport) this.blink(a, cast); // Round 3: Cloudstep (MOVES stream).
    const age = this.serverTime - cast.start - (cast.slot === 'ultimate' ? 0 : AGE_EPSILON); // Round 3d (PACE): see AGE_EPSILON.
    if (this.timeStopTour(a, cast)) return;
    if (this.ultimateTick(a, cast)) return; // Round 3d (ULTS): a hit-confirm ultimate's confirm, whiff and cinematic.
    // A ground smash strikes as its feet reach the floor: until then it falls, and on landing its clock is set so its
    // first contact is now - the renderer holds the pose before the blow while it falls (combos.ts).
    if (cast.move.plunge && cast.airborne && !cast.landed) {
      if (!a.state.grounded && this.serverTime - cast.start < PLUNGE_LIMIT) return;
      cast.landed = true;
      const late = this.serverTime - cast.start - cast.move.contacts[0];
      if (late > 0) { cast.start += late; a.state.actionStarted = cast.start; }
      cast.endpoint = { x: a.state.x, y: a.state.y + .3, z: a.state.z };
      // Round 4b (JUMP): dropped from the top of a jump, the floor takes it - the landing the ultimates' launches
      // have (CombatEffects' ground impact, the heavy landing's sound), and the drop, for whatever scales with it.
      const drop = cast.plungeFrom === undefined ? 0 : Math.max(0, cast.plungeFrom - a.state.y);
      if (a.state.grounded && drop >= PLUNGE_IMPACT_DROP)
        this.emit({ kind: 'land', actorId: a.state.id, fighter: a.state.fighter, slot: cast.slot, ...(cast.branch ? { branch: cast.branch } : {}), origin: position(a.state), drop: +drop.toFixed(2) });
      this.updateCast(a); return;
    }
    while (cast.nextContact < cast.move.contacts.length && age >= cast.move.contacts[cast.nextContact]) {
      const contact = cast.nextContact++;
      if (cast.move.area) { this.releaseArea(a, cast, contact); continue; }
      if(cast.move.timeStop?.contact===contact){
        const stop=cast.move.timeStop,origin=centre(a.state);
        // Round 4b (FMOVES): a dome (TourStyle.domain) closes on everybody inside it - a pillar is no shelter.
        const domain=!a.kit&&!!(stop.tour??TIME_STOP_TOURS[a.state.fighter])?.domain;
        this.emit({kind:'release',actorId:a.state.id,fighter:a.state.fighter,slot:cast.slot,origin,endpoint:position(origin),contactIndex:contact});
        for(const target of this.actors.values()){
          // Ground hits: a fighter down or getting up is caught like anybody else (an ultimate connects through both).
          if(!this.hostile(a.state,target.state)||!target.state.alive||distance(origin,centreOf(target.state))>stop.radius||this.serverTime<target.evadeUntil
            ||this.floorDodges(target,cast.slot,this.fighterBlow(a,target)))continue;
          const obstruction=domain?undefined:this.collision?.raycast?.(origin,centreOf(target.state));
          if(obstruction&&distance(origin,obstruction)+.1<distance(origin,centreOf(target.state)))continue;
          target.freezeUntil=Math.max(target.freezeUntil,this.serverTime+stop.duration);target.state.timeStopped=true;
        }
        this.external?.freeze(origin,stop.radius,stop.duration,a.state.id);
      }else if(cast.move.style==='field'){
        const origin=centre(a.state),endpoint=cast.endpoint;
        this.emit({kind:'release',actorId:a.state.id,fighter:a.state.fighter,slot:cast.slot,origin,endpoint:position(endpoint),contactIndex:contact,...(cast.branch?{branch:cast.branch}:{})});
        for(const target of this.actors.values()){
          if(!this.hostile(a.state,target.state)||!target.state.alive||distance(centreOf(target.state),endpoint)>cast.move.radius+radiusOf(target.state))continue;
          const obstruction=this.collision?.raycast?.(origin,centreOf(target.state));
          if(obstruction&&distance(origin,obstruction)+.1<distance(origin,centreOf(target.state)))continue;
          this.hit(a.state.id,target,cast.slot,cast.move,endpoint,contact===cast.move.contacts.length-1,endpoint,contact,cast.opened,cast.id,cast.stage);
        }
        if(this.external){
          const n=this.external.query(endpoint,endpoint,cast.move.radius+1.2,this.nearby);
          for(let i=0;i<n;i++){const body=this.nearby[i];
            if(this.external.hostile?.(a.state.id,body)===false||Math.hypot(body.x-endpoint.x,body.y+body.height*.55-endpoint.y,body.z-endpoint.z)>cast.move.radius+body.radius)continue;
            this.hitExternal(a.state.id,body,cast.slot,cast.move,endpoint,contact===cast.move.contacts.length-1,contact,cast.id,cast.stage);}
        }
      }else if (cast.move.style === 'melee' || cast.move.style === 'beam') {
        if (cast.move.track && cast.move.style === 'beam') this.trackLine(a, cast); // Round 4b (GUMMY): the SUNSET BARRAGE's next fist.
        if (cast.move.style === 'beam' || !traitsOf(a.state.fighter).quietMeleeRelease) {
          // The release and its hit results share this authority tick. Rendering
          // must not draw to maximum range a frame before the hit is known.
          // An iai cut is released along the line its dash ran.
          const origin = cast.through ? centre(cast.through.from) : centre(a.state);
          this.emit({ kind: 'release', actorId: a.state.id, fighter: a.state.fighter, slot: cast.slot, origin,
            endpoint: cast.move.style === 'beam' ? cast.endpoint : cast.through ? centre(a.state)
              : { x: origin.x + cast.direction.x * cast.move.range, y: origin.y, z: origin.z + cast.direction.z * cast.move.range },
            contactIndex: contact, chain: cast.slot === 'light' ? cast.stage : undefined, ...(cast.branch ? { branch: cast.branch } : {}) });
        }
        // A melee contact that finds nobody on the tick it comes due stays
        // open for its active frames instead of being thrown away. The window
        // never outlives the move itself.
        if (!this.sweep(a, cast, contact) && cast.move.style === 'melee' && a.cast === cast) {
          (cast.live ??= []).push({ index: contact,
            until: Math.min(cast.start + cast.move.duration, this.serverTime + activeWindow(cast.move)) });
        }
        if (a.cast !== cast) return;
      } else {
        const start = attackOrigin(a.state,cast.move);
        // Round 4b (FMOVES): aimed as it is let go - Round 8 (ULT AIM): a bomb at where it will come down on them.
        if (cast.move.style === 'bomb' ? cast.move.aimOnRelease : aimsAsLetGo(cast.move)) { if (cast.move.style === 'bomb') this.aimBomb(a, cast, start); else this.aimShot(a, cast, start); }
        this.emit({ kind: 'release', actorId: a.state.id, fighter: a.state.fighter,
          slot: cast.slot, origin: start, endpoint: position(cast.endpoint), contactIndex: contact, chain: cast.slot === 'light' ? cast.stage : undefined });
        this.projectiles.push({ actorId: a.state.id, fighter: a.state.fighter, slot: cast.slot, move: cast.move,
          start, end: position(cast.endpoint), startAt: this.serverTime,
          duration: Math.max(0.06, distance(start, cast.endpoint) / (cast.move.speed ?? 20)), previous: start, opened: cast.opened,
          castId: cast.id, stage: cast.stage, aimId: a.state.target ?? undefined, ...(cast.beat ? { beat: true } : {}), ...(cast.mash ? { mash: true } : {}),
          ...(cast.move.aimOnRelease && cast.move.style === 'bomb' ? { aimed: position(cast.endpoint) } : {}) });
      }
    }
    // Everything still inside its active frames gets another look this tick.
    // A contact leaves the list the moment it connects, so a single swing can
    // still only land once however long its window is.
    if (cast.live?.length) {
      for (let i = cast.live.length - 1; i >= 0; i--) {
        const open = cast.live[i];
        if (this.serverTime > open.until) { cast.live.splice(i, 1); continue; }
        if (this.sweep(a, cast, open.index)) cast.live.splice(i, 1);
        if (a.cast !== cast) return;
      }
    }
    // The ball rooms (SportFeel.recovery): a light or a heavy whose blows are all out, none still looking for a body, is
    // over a moment after its last one - a kick recovers and the play flows on - instead of playing out its tail.
    const quick = this.assist?.sport?.recovery, contacts = cast.move.contacts;
    const cut = quick !== undefined && (cast.slot === 'light' || cast.slot === 'heavy') && cast.move.style === 'melee' && !cast.move.plunge
      && !(cast.dive && this.serverTime < cast.dive.until) && cast.nextContact >= contacts.length && !cast.live?.length && age >= contacts[contacts.length - 1] + quick;
    if (age >= cast.move.duration || cut) {
      a.cast = null;
      // A stage that ran its whole course, hit or whiff, leaves the string
      // open for RUSH_WINDOW - unless it was the last one the string has.
      if (cast.slot === 'light') {
        a.rushStage = cast.stage; a.lockRound = cast.round ?? 0;
        a.rushUntil = this.rushFollow(a, cast) ? this.serverTime + RUSH_WINDOW : -Infinity;
        a.rushOpened = [...cast.opened];
        // Techniques: a string's second blow that landed, run to its end - a light held back a beat now is the Delayed
        // Strike (DELAY_FROM: past the window that carries the string on, so a press made sooner is the next stage).
        if (cast.stage === 1 && !cast.branch && !cast.airborne && cast.connected && !a.kit) { a.delayFrom = this.serverTime + DELAY_FROM; a.delayUntil = this.serverTime + DELAY_TO; }
      }
      // Techniques: a heavy (or the heavy string's second blow) that met a body leaves the next blow of the heavy string
      // open a moment after it ends, on the floor or off it (heavyString).
      if (cast.slot === 'heavy' && (!cast.branch || cast.branch === 'hh') && cast.connected && !a.kit) {
        a.heavyChainUntil = this.serverTime + HEAVY_CHAIN_WINDOW; a.heavyChainStage = cast.branch === 'hh' ? 2 : 1;
      }
    }
  }

  /** Round 4b (GUMMY): a line thrown again and again (MoveDefinition.track),
   *  its next contact thrown at where the fighter it is aimed at - its
   *  thrower's target - stands now: inside its range, and within `track`
   *  of the line the cast went out along (`direction`, which never moves).
   *  Anywhere else the line stays where it was. */
  private trackLine(a: Actor, cast: Cast) {
    const q = a.state.target ? this.actors.get(a.state.target)?.state : undefined;
    if (!q?.alive || !this.hostile(a.state, q)) return;
    const from = attackOrigin(a.state, cast.move), c = centreOf(q), range = cast.move.range;
    const dx = c.x - from.x, dy = c.y - from.y, dz = c.z - from.z, n = Math.hypot(dx, dy, dz);
    if (n < 1e-3 || n > range) return;
    const d = cast.direction, dn = Math.hypot(d.x, d.y, d.z) || 1;
    if ((dx * d.x + dy * d.y + dz * d.z) / (n * dn) < Math.cos(cast.move.track!)) return;
    const end = { x: from.x + dx / n * range, y: from.y + dy / n * range, z: from.z + dz / n * range };
    cast.endpoint = this.collision?.raycast?.(from, end) ?? end;
  }

  /** One pass of a melee or beam contact over everybody it could touch.
   *  Returns whether it found anyone, which is what decides if the contact is
   *  spent or stays open for the rest of its active frames. */
  private sweep(a: Actor, cast: Cast, contact: number): boolean {
    // An iai draw cuts along the line its dash ran, from where it set off to
    // where it stands; whoever it passed through is behind it by now. The
    // blow is guarded from the side it came from, and throws them back that
    // way - away from the fighter standing past them.
    const through = cast.through;
    const origin = through ? centre(through.from) : centre(a.state);
    // The cut runs the dash and the blade's length on past where it stopped.
    const tip = through ? centre(a.state) : origin;
    const endpoint = cast.move.style === 'beam' ? cast.endpoint : {
      x: tip.x + cast.direction.x * cast.move.range,
      y: tip.y, z: tip.z + cast.direction.z * cast.move.range,
    };
    let landed = false;
    for (const target of this.actors.values()) {
      if (!this.hostile(a.state, target.state) || !target.state.alive) continue;
      // Where the thrower saw them (lag compensation; as they stand with it off).
      const seen = this.seenBy(a, target.state);
      if (!this.inBlowLane(a, cast, seen, origin, endpoint)) continue; // Round 3c (LOCK): nobody at the thrower's side or back.
      const tc = centreOf(seen);
      // A bigger body is reached sooner by however much wider it is.
      const girth = radiusOf(target.state) - PLAYER_RADIUS;
      // An iai cut reaches as far off the line it ran as the swing reaches
      // from where a fighter stands; any other swing is its segment volume.
      if (through ? segmentDistance(tc, origin, tip) > this.reachOf(a, cast.slot, cast.move, !cast.airborne) + girth
        : segmentDistance(tc, origin, endpoint) > cast.move.radius + radiusOf(target.state)) continue;
      // Beam into beam. They cancel; `cancelBeams` clears this cast, so there
      // is nothing left to do here.
      if (cast.move.style === 'beam' && this.headOn(a, target)) {
        this.cancelBeams(a, target,
          { x: (origin.x + tc.x) / 2, y: (origin.y + tc.y) / 2, z: (origin.z + tc.z) / 2 });
        return true;
      }
      const dx = tc.x - origin.x, dz = tc.z - origin.z;
      if (!through && cast.move.style === 'melee' && dx * cast.direction.x + dz * cast.direction.z < -0.1) continue;
      // A swing only lands on somebody it can actually touch. The segment
      // volume alone let every melee move in the roster connect from well
      // outside the animation - an opening that has not closed the gap is a
      // whiff, which is what the lunge is for. (A cut along a dash touched
      // everything it ran through.)
      if (!through && cast.move.style === 'melee' && distance(a.state, seen) > this.reachOf(a, cast.slot, cast.move, !cast.airborne) + girth) continue;
      const obstruction = this.collision?.raycast?.(origin, tc);
      if (obstruction && distance(origin, obstruction) + 0.1 < distance(origin, tc)) continue;
      const blow = through ? centre(a.state) : origin;
      this.hit(a.state.id, target, cast.slot, cast.move, blow, contact === cast.move.contacts.length - 1, blow, contact, cast.opened, cast.id, cast.stage, through ? origin : undefined);
      landed = true;
      if (a.cast !== cast) return true;
    }
    // The horde, by the same volumes: a swing cuts every body it passes through.
    if (this.external) {
      const reach = this.reachOf(a, cast.slot, cast.move, !cast.airborne);
      const far = through ? tip : endpoint, wide = through ? reach : cast.move.radius;
      const n = this.external.query(origin, far, wide + 1.2, this.nearby);
      for (let i = 0; i < n; i++) {
        const body = this.nearby[i];
        const bc = { x: body.x, y: body.y + body.height * .55, z: body.z }, girth = body.radius - PLAYER_RADIUS;
        if (through ? segmentDistance(bc, origin, tip) > reach + girth : segmentDistance(bc, origin, endpoint) > cast.move.radius + body.radius) continue;
        if (!through && cast.move.style === 'melee') {
          if ((bc.x - origin.x) * cast.direction.x + (bc.z - origin.z) * cast.direction.z < -0.1) continue;
          if (Math.hypot(body.x - a.state.x, body.y - a.state.y, body.z - a.state.z) > reach + girth) continue;
        }
        if (this.hitExternal(a.state.id, body, cast.slot, cast.move, through ? centre(a.state) : origin, contact === cast.move.contacts.length - 1, contact, cast.id, cast.stage)) landed = true;
        if (a.cast !== cast) return true;
      }
    }
    return landed;
  }

  private areaCentre(a: Actor, m: MoveDefinition, target: PlayerState | null): Vec3 {
    const p = a.state, aim = a.attackAim;
    // A self sweep occupies the physical body, including its feet while airborne.
    if (m.range === 0) return { x: +p.x.toFixed(3), y: +p.y.toFixed(3), z: +p.z.toFixed(3) };
    let x: number, z: number;
    if (aim && Number.isFinite(aim.x) && Number.isFinite(aim.z)) { x = aim.x; z = aim.z; }
    else if (target?.alive && Math.hypot(target.x - p.x, target.z - p.z) <= m.range) { x = target.x; z = target.z; }
    else { const ahead = Math.min(AREA_DEFAULTS.aim, m.range); x = p.x + Math.sin(p.yaw) * ahead; z = p.z + Math.cos(p.yaw) * ahead; }
    const dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz);
    if (d > m.range && d > 0) { x = p.x + dx / d * m.range; z = p.z + dz / d * m.range; }
    const { halfX, halfZ } = this.bounds;
    x = clamp(x, -halfX, halfX); z = clamp(z, -halfZ, halfZ);
    return { x: +x.toFixed(3), y: this.floorAt(x, z, p.y), z: +z.toFixed(3) };
  }
  /** The floor at (x, z): the first fixed surface down from well above the caster's height, else the ground (0). */
  private floorAt(x: number, z: number, near: number): number {
    if (!this.collision?.raycast) return 0;
    const top = Math.max(near, 0) + 12, hit = this.collision.raycast({ x, y: top, z }, { x, y: -20, z });
    return hit.y > -19.9 ? +hit.y.toFixed(3) : 0;
  }
  /** An area move's release (its one contact, the end of the cast animation): the circle goes down where the cast
   *  aimed it, every screen is told when it will strike, and it waits (updateAreas). */
  private releaseArea(a: Actor, cast: Cast, contact: number) {
    // A physical self-centered sweep follows its body through the windup. Remote casts keep their aimed point.
    if (cast.move.range === 0) cast.endpoint = this.areaCentre(a, cast.move, null);
    const m = cast.move, area = m.area!, due = this.serverTime + area.telegraph, offsets = strikeOffsets(m);
    this.emit({ kind: 'release', actorId: a.state.id, fighter: a.state.fighter, slot: cast.slot, origin: centre(a.state), endpoint: position(cast.endpoint),
      contactIndex: contact, radius: m.radius, due: +due.toFixed(4), move: m.name, ...(area.fx ? { look: area.fx } : {}), strikes: offsets.length });
    if (!this.resolveAreas) return;
    this.areas.push({ actorId: a.state.id, fighter: a.state.fighter, move: m, at: position(cast.endpoint), due, offsets, next: 0, castId: cast.id, opened: new Map() });
  }
  /** Every circle whose strike is due lands it: an 'impact', then a blow on every opponent inside - the circle's
   *  radius on the floor, up to its height - wherever they stood when it was cast. Its caster need not be there. The
   *  strikes land when the move's look strikes (`offsets`, areaDamage.ts), its damage split across them, and each blow
   *  is worth more the nearer the centre it finds its body (areaFalloff: all of it in the bullseye, half at the rim). */
  private updateAreas() {
    for (let i = this.areas.length - 1; i >= 0; i--) {
      const strike = this.areas[i], m = strike.move, area = m.area!, hits = strike.offsets.length;
      while (strike.next < hits && this.serverTime >= strike.due + strike.offsets[strike.next]) {
        const k = strike.next++, finisher = k === hits - 1, at = strike.at, height = area.height ?? AREA_DEFAULTS.height;
        const caster = this.actors.get(strike.actorId)?.state;
        this.emit({ kind: 'impact', actorId: strike.actorId, fighter: strike.fighter, slot: 'area', origin: position(at), endpoint: position(at),
          contactIndex: k, radius: m.radius, move: m.name, ...(area.fx ? { look: area.fx } : {}), strikes: hits });
        if (caster) for (const target of this.actors.values()) {
          const q = target.state, off = Math.hypot(q.x - at.x, q.z - at.z);
          if (q.id === caster.id || !q.alive || !this.hostile(caster, q)) continue;
          if (off > m.radius + radiusOf(q) || q.y < at.y - 1 || q.y > at.y + height) continue;
          this.hit(strike.actorId, target, 'area', m, at, finisher, at, k, strike.opened, strike.castId, 0, undefined, false, false, areaBlow(off, m.radius));
        }
        if (caster && this.external) {
          const n = this.external.query(at, at, m.radius + 1.2, this.nearby);
          for (let j = 0; j < n; j++) {
            const body = this.nearby[j], off = Math.hypot(body.x - at.x, body.z - at.z);
            if (this.external.hostile?.(strike.actorId, body) === false || off > m.radius + body.radius
              || body.y < at.y - 1 || body.y > at.y + height) continue;
            this.hitExternal(strike.actorId, body, 'area', m, at, finisher, k, strike.castId, 0, areaBlow(off, m.radius));
          }
        }
      }
      if (strike.next >= hits) this.areas.splice(i, 1);
    }
  }

  private updateProjectiles(dt = 0) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const shot = this.projectiles[i];
      if (shot.aimed) this.homeBomb(shot, dt); // Round 8 (ULT AIM)
      const t = clamp((this.serverTime - shot.startAt) / shot.duration, 0, 1);
      const point = { x: shot.start.x + (shot.end.x - shot.start.x) * t,
        y: shot.start.y + (shot.end.y - shot.start.y) * t, z: shot.start.z + (shot.end.z - shot.start.z) * t };
      let impacted = t >= 1;
      // Two shots from opposite sides meeting in the air cancel, the same as
      // two beams. It happens constantly - a Galewheel into a Nightfang
      // Tenshou - so it is worth the six lines.
      for (let j = i - 1; j >= 0 && !impacted && shot.move.style !== 'bomb'; j--) {
        const other = this.projectiles[j];
        if (other.actorId === shot.actorId || other.move.style === 'bomb') continue;
        const shooters = [this.actors.get(shot.actorId)?.state, this.actors.get(other.actorId)?.state];
        if (shooters[0] && shooters[1] && !this.hostile(shooters[0], shooters[1])) continue;
        const ot = clamp((this.serverTime - other.startAt) / other.duration, 0, 1);
        const op = { x: other.start.x + (other.end.x - other.start.x) * ot,
          y: other.start.y + (other.end.y - other.start.y) * ot,
          z: other.start.z + (other.end.z - other.start.z) * ot };
        if (distance(point, op) > shot.move.radius + other.move.radius) continue;
        const midpoint = { x: (point.x + op.x) / 2, y: (point.y + op.y) / 2, z: (point.z + op.z) / 2 };
        this.emit({ kind: 'projectile-clash', actorId: shot.actorId, targetId: other.actorId,
          fighter: shot.fighter, slot: shot.slot, origin: midpoint, endpoint: position(midpoint),
          damage: Math.round(shot.move.damage + other.move.damage) });
        this.projectiles.splice(j, 1);
        i--;
        impacted = true;
      }
      const shooter = this.actors.get(shot.actorId)?.state;
      if (!impacted && shot.move.style === 'projectile') {
        for (const a of this.actors.values()) {
          if (!a.state.alive || a.state.id === shot.actorId || (shooter && !this.hostile(shooter, a.state))
            // Round 3c (LOCK): only the body it was thrown at, and what is in
            // front of where it was thrown from - along the floor, since a
            // shot can leave from high over its thrower's shoulder (Ikazuchi
            // Arrow, off the Guardian's bow) and come down past the body
            // standing under it. Arcade survival's sides as in inBlowLane.
            || shooter?.team === undefined && a.state.id !== shot.aimId
              && !this.inLane(a.state, shot.start, shot.end.x - shot.start.x, 0, shot.end.z - shot.start.z)) continue;
          if (segmentDistance(centreOf(a.state), shot.previous, point) <= shot.move.radius + radiusOf(a.state)) {
            this.hit(shot.actorId, a, shot.slot, shot.move, shot.start, true, shot.start, undefined, shot.opened, shot.castId, shot.stage);
            impacted = true;
            break;
          }
        }
        // Through the horde: a light shot stops in the first body it meets; a
        // special or an ultimate tears through the crowd, each body once.
        if (!impacted && this.external && shooter) {
          const n = this.external.query(shot.previous, point, shot.move.radius + 1.2, this.nearby);
          for (let k = 0; k < n; k++) {
            const body = this.nearby[k];
            if (shot.pierced?.has(body.id)) continue;
            if (segmentDistance({ x: body.x, y: body.y + body.height * .55, z: body.z }, shot.previous, point) > shot.move.radius + body.radius) continue;
            if (!this.hitExternal(shot.actorId, body, shot.slot, shot.move, shot.start, true, undefined, shot.castId, shot.stage)) continue;
            if (shot.slot === 'light' || shot.slot === 'heavy') { impacted = true; break; }
            (shot.pierced ??= new Set()).add(body.id);
          }
        }
      }
      if (impacted) {
        if (shot.move.style === 'bomb') for (const a of this.actors.values()) {
          if (a.state.alive && a.state.id !== shot.actorId && (!shooter || this.hostile(shooter, a.state))
            && distance(centreOf(a.state), shot.end) <= shot.move.radius + radiusOf(a.state) - PLAYER_RADIUS) {
            this.hit(shot.actorId, a, shot.slot, shot.move, shot.end, true, shot.start, undefined, shot.opened, shot.castId, shot.stage);
          }
        }
        if (shot.move.style === 'bomb' && this.external && shooter) {
          const n = this.external.query(shot.end, shot.end, shot.move.radius + 1.2, this.nearby);
          for (let k = 0; k < n; k++) {
            const body = this.nearby[k];
            if (Math.hypot(body.x - shot.end.x, body.y + body.height * .55 - shot.end.y, body.z - shot.end.z) > shot.move.radius + body.radius - PLAYER_RADIUS) continue;
            this.hitExternal(shot.actorId, body, shot.slot, shot.move, shot.end, true, undefined, shot.castId, shot.stage);
          }
        }
        this.projectiles.splice(i, 1);
      } else shot.previous = point;
    }
  }

  private hit(actorId: string, target: Actor, slot: AttackSlot, move: MoveDefinition, origin: Vec3, finisher: boolean, incomingOrigin = origin, contactIndex?: number, opened?: Map<string, number>, castId?: number, stage = 0, guardFrom?: Vec3, minor = false, crowd = false, area?: AreaBlow) {
    const p = target.state;
    const attacker = this.actors.get(actorId);
    // Ground hits (moves.ts GROUND_HIT_SCALE): one fighter's blow on another
    // finds a body on the floor open to it; anything else keeps the old rule.
    const fighters = this.fighterBlow(attacker, target, minor, crowd);
    if (this.serverTime < target.evadeUntil || this.floorDodges(target, slot, fighters)) { this.emit({ kind: 'dodge', actorId, targetId: p.id, slot, contactIndex }); return; }
    // A fighter's normal on a body down on the floor is a ground hit: it lands
    // for less, leaves the body where it lies, and keeps it there a beat at
    // most (GROUND_HIT_HOLD, never past `floorUntil`). An ultimate is not one:
    // it lands whole, as on a fighter standing.
    const floored = fighters && slot !== 'ultimate' && this.down(target);
    // Whether this contact belongs to the cast its thrower is in now. By cast,
    // not by slot: a shot from one rush stage that lands during the next is
    // the earlier stage's hit, and must not open the new stage's cancels or
    // stamp its input sequence on the event.
    const own = attacker?.cast && castId !== undefined && attacker.cast.id === castId ? attacker.cast : undefined;
    // Connected, which is what opens the cancel routes - set before the block
    // branch can return rather than after it. A blocked move used to leave its
    // thrower locked in a recovery nothing could cancel, which is most of what
    // makes a guard read as a wall instead of as a moment in an exchange.
    if (own) own.connected = true;
    let fromX = origin.x - p.x, fromZ = origin.z - p.z;
    // A locked bomb lands at the target centre. Preserve its incoming direction
    // there; a zero radial vector otherwise removes all horizontal recoil.
    if (Math.hypot(fromX, fromZ) < 0.001) {
      fromX = incomingOrigin.x - p.x;
      fromZ = incomingOrigin.z - p.z;
    }
    // Which side the blow came from, for the guard: where it was thrown from,
    // which for an iai cut is where its dash set off, not where it ended.
    const faceX = guardFrom ? guardFrom.x - p.x : fromX, faceZ = guardFrom ? guardFrom.z - p.z : fromZ;
    const front = (Math.sin(p.yaw) * faceX + Math.cos(p.yaw) * faceZ) / Math.max(0.001, Math.hypot(faceX, faceZ)) > GUARD_FRONT;
    // What a transformation is worth: harder hits going out, softer coming in.
    let damage = (finisher ? move.finisherDamage ?? move.damage : move.damage) * (area?.scale ?? 1) * (attacker?.state.awakened ? AWAKENED_DAMAGE : 1) * (p.awakened ? AWAKENED_RESIST : 1);
    // Arcade survival's upgrades and enemy tiers. A roster fighter in a room
    // carries no mods, and none of this runs.
    let critical = false;
    if (attacker?.mods || target.mods) {
      damage *= (attacker?.mods?.damageOut ?? 1) * (target.mods?.damageIn ?? 1);
      if (attacker?.mods?.crit && this.random() < attacker.mods.crit) { critical = true; damage *= attacker.mods.critDamage; }
    }
    // Adaptive difficulty (adaptive.ts): a bot's strength, half in its blows and half in what it takes.
    damage *= this.adaptive.factor(attacker?.state.id, p.id);
    // Techniques: a counter stance's blow, thrown because a blow met the stance, is worth COUNTER_DAMAGE of itself.
    if (own?.countered) damage *= COUNTER_DAMAGE;
    // Techniques: a counter stance (MoveDefinition.stance) met from the front by a fighter's melee blow inside its window
    // answers it: the blow is undone, its thrower reels, and the stance's own blow comes at once (counterStance).
    const stance = target.cast?.move.stance;
    if (stance && !target.cast!.countered && !floored && !crowd && attacker && attacker !== target && !attacker.kit && front
      && move.style === 'melee' && slot !== 'ultimate') {
      const into = this.serverTime - target.cast!.start;
      if (into >= stance.from && into <= stance.to) { this.counterStance(target, attacker, fromX, fromZ, slot, contactIndex); return; }
    }
    let guardBreak = false;
    // Round 5 (PARRY): a guard is up while it is held, and through the
    // blockstun a blocked blow leaves - button or not. `p.guarding` drops for
    // the blockstun (it is derived through stunUntil), and a blow arriving
    // inside it used to land clean on a fighter standing in their guard.
    const guardUp = p.guarding || this.serverTime < target.blockedUntil && !target.reaction;
    if (guardUp) {
      // The Perfect Parry. Blocking is a tax when it only costs you stamina;
      // blocking *on the beat* has to be worth something, and what it is
      // worth is the thrower reeling in front of you. A fresh press
      // (`guardAt`, PARRY_REARM, PARRY_LOCKOUT), the blow in front, the
      // button still down - and never an ultimate, which is dodged. It beats
      // a guard-breaking blow, which a held guard cannot: that is the
      // high-skill answer to a red move.
      if (front && slot !== 'ultimate' && target.guardHeld && this.serverTime - target.guardAt <= JUST_GUARD_WINDOW) {
        target.parryCaught = true;
        p.ultimate = Math.min(100, p.ultimate + JUST_GUARD_METER);
        p.stamina = Math.min(p.maxStamina ?? 100, p.stamina + PARRY_STAMINA);
        this.freeze(target, PARRY_FREEZE);
        // A thrower in reach reels; a shot from across the arena is only
        // destroyed (its thrower plays out the rest of their move), and a beam
        // is cut off at the guard wherever it came from.
        const thrower = attacker && attacker !== target ? attacker : undefined;
        const reach = !!thrower && (move.style === 'melee' || distance(thrower.state, p) <= PARRY_REACH);
        // Where the guard met the blow, for the event: the defender as they stood, before any vanish.
        const guardedAt = centre(p);
        // Read against a melee swing, the parry is a vanish: the defender is
        // behind the attacker before the attacker has finished missing.
        const vanished = reach && move.style === 'melee' ? this.vanish(target, thrower!) : null;
        if (thrower && (reach || move.style === 'beam')) { thrower.cast = null; thrower.rushUntil = -Infinity; }
        if (thrower && reach) {
          const stagger = thrower.kit ? JUST_GUARD_ADVANTAGE_KIT : JUST_GUARD_ADVANTAGE;
          thrower.stunUntil = Math.max(thrower.stunUntil, this.serverTime + stagger);
          thrower.parriedUntil = this.serverTime + stagger;
          thrower.dashUntil = Math.min(thrower.dashUntil, this.serverTime);
          thrower.reaction = 'hurt'; thrower.reactionClip = stagger; thrower.staggeredAt = this.serverTime;
          this.freeze(thrower, PARRY_FREEZE);
          const n0 = Math.hypot(fromX, fromZ) || 1;
          // Knocked back off the guard - or, when the guard has vanished, a
          // stumble on into the space it left, not back into the body now
          // standing behind them.
          const shove = vanished ? -VANISH_STUMBLE : 3.5;
          thrower.kx = fromX / n0 * shove; thrower.kz = fromZ / n0 * shove; thrower.knockbackDrag = 10;
          this.action(thrower, 'hurt', stagger, true);
          // The punish is the defender's: an attack pressed through the reel
          // goes out with the guard still held (see `counterUntil`).
          target.counterUntil = this.serverTime + PARRY_FREEZE + stagger;
          // A bot sees its own parry and answers it, sooner the better it is.
          if (p.isBot) target.nextBotThink = Math.min(target.nextBotThink, this.serverTime + PARRY_FREEZE + .22 - .14 * target.botSkill);
        }
        this.emit({ kind: 'just-guard', actorId, targetId: p.id, fighter: attacker?.state.fighter, slot, contactIndex,
          damage: Math.round(damage), chain: slot === 'light' ? stage : undefined, branch: own?.branch,
          reason: reach ? undefined : 'deflect', origin: position(origin), endpoint: guardedAt });
        if (vanished) this.emit({ kind: 'vanish', actorId: p.id, targetId: actorId, fighter: p.fighter, slot,
          origin: vanished.from, endpoint: vanished.to });
        return;
      }
      // What a blocked blow costs: a share of the bar by slot, spread over a
      // multi-contact move's contacts, and a share of what it would have
      // dealt - more from beside or behind, which a held guard still covers
      // (GUARD_REAR_COST). A guard-breaking blow breaks a held guard outright,
      // and an ultimate that breaks guards can only be dodged.
      const guardCost = (GUARD_COST[slot] / Math.max(1, move.area ? strikeOffsets(move).length : move.contacts.length) + GUARD_COST_DAMAGE * damage) * (front ? 1 : GUARD_REAR_COST);
      p.stamina = Math.max(0, p.stamina - guardCost);
      guardBreak = p.stamina === 0 || !!move.guardBreak;
      // Chip. A normal cannot take the last point of health off a guard - the
      // floor at 1 is what stops a round ending with nobody landing a hit -
      // but an ultimate can, which is what makes spending the bar a threat
      // against someone who will not move.
      // What the guard turned away still counts for something: a fighter
      // who blocks well builds toward their transformation, just slower than
      // one who is being hit.
      const unblocked = damage;
      p.awakening = Math.min(100, (p.awakening ?? 0) + unblocked * AWAKENING_PER_BLOCKED);
      damage = Math.max(1, Math.round(damage * (guardBreak ? 0.6 : CHIP[slot])));
      this.emit({ kind: guardBreak ? 'guard-break' : 'blocked', actorId, targetId: p.id, slot, damage,
        contactIndex, origin: position(origin), endpoint: centre(p), fromBehind: !front || undefined,
        chain: slot === 'light' ? stage : undefined, branch: own?.branch });
      if (!guardBreak) {
        const before = p.hp;
        p.hp = slot === 'ultimate' ? Math.max(0, p.hp - damage) : Math.max(1, p.hp - damage);
        this.tally(target, attacker, before - p.hp);
        if (p.hp === 0) { this.eliminate(target, actorId); return; }
        // What a block does to two bodies. A blocked hit shoves the defender,
        // shoves the attacker back rather less, freezes both, and holds the
        // defender in their guard where they cannot swing back. Round 5: far
        // enough to be room - a whole string blocked, or an ender, ends the
        // exchange (BLOCK_PUSH_ENDER) - and a multi-contact move's ticks only
        // nudge until its last.
        const blockN = Math.hypot(fromX, fromZ) || 1;
        const ender = finisher && (slot === 'light' ? stage >= RUSH_STAGES - 1 : !!own?.branch || !!move.ender);
        const shove = !finisher ? BLOCK_PUSH.light : ender ? Math.max(BLOCK_PUSH_ENDER, BLOCK_PUSH[slot]) : BLOCK_PUSH[slot];
        target.kx = -fromX / blockN * shove; target.kz = -fromZ / blockN * shove;
        target.knockbackDrag = BLOCK_DRAG; target.mx = target.mz = 0;
        target.blockedUntil = this.serverTime + BLOCK_STUN[slot];
        target.stunUntil = Math.max(target.stunUntil, target.blockedUntil);
        const held = HITSTOP[slot] * .6;
        this.freeze(target, held);
        if (attacker && attacker !== target) {
          this.freeze(attacker, held);
          attacker.kx = fromX / blockN * shove * BLOCK_RECOIL; attacker.kz = fromZ / blockN * shove * BLOCK_RECOIL;
          attacker.knockbackDrag = BLOCK_DRAG;
        }
        return;
      }
    }
    // Read before anything launches them: the bounce belongs to a hit that
    // caught someone *already* in the air, not to the hit that put them there.
    const airborneBefore = !p.grounded;
    if (this.serverTime - target.lastDamageAt > 1.2) {
      target.chainHits = target.scalingHits = 0;
      // Techniques: a combo over - its kinds go.
      target.comboKinds = 0;
    }
    // Techniques: a string over (ROUTE_GAP without a blow, or its record full) - a bot keeps how it opened (familiarity).
    if (this.serverTime - target.lastDamageAt > ROUTE_GAP || target.routeNow.length >= ROUTE_CHARS) {
      if (target.routeNow.split('.').length >= ROUTE_HEAD) target.seenRoutes = [...target.seenRoutes.slice(-(ROUTES_KEPT - 1)), target.routeNow.split('.').slice(0, ROUTE_HEAD + 1).join('.')];
      target.routeNow = '';
    }
    // Two counters, because they answer two questions. Damage scaling counts
    // every contact and is never reset by the breaker: it is a defensive
    // escape, and resetting the scaler on it handed the attacker a fresh 1.0x
    // for the trouble of being escaped from - which also put the floor out of
    // reach of anything but a barrage. The breaker's own budget is charged
    // once per cast, on the first contact of that cast to land on this body;
    // it used to count contacts and read its threshold off whichever move
    // had just landed, so Konta's three-hit light fired it on his second
    // cast while KoKo could push past it by switching into GAN.
    // A crowd's blows are not a string: each lands whole, and none of them
    // counts toward the scaler or the breaker a duel's combos answer to - a
    // horde swinging from every side used to hit for a third after its first
    // few blows, and hand the fighter a breaker's evade for being surrounded.
    const opening = !opened?.has(p.id);
    if (!crowd && (opening || slot !== 'area' || target.scalingHits === 0)) target.scalingHits++;
    if (opening && !crowd) { target.chainHits++; opened?.set(p.id, target.chainHits); }
    // Hitstun scales on the breaker count. A multi-contact finisher reads the
    // count its cast opened on: the running count is what crushed GAN's
    // authored 1.1 s finisher to a quarter of a second and HUSH's 2.3 s
    // to a half, because their own ticks had been charging it.
    const chain = finisher ? opened?.get(p.id) ?? target.chainHits : target.chainHits;
    const stunScale = Math.max(0.2, 1 - Math.max(0, chain - 1) * 0.14);
    // Damage scaling. Without it a long juggle is worth more than it should be,
    // and the first fighter to open a string simply wins the round.
    // Round 4b (COMBAT): fighter against fighter, a combo ender is its string's payoff - the scaling bites it at
    // ENDER_SCALING of its rate - a light thrown while mashing is worth MASH_SCALE, and an ender on the beat
    // RHYTHM_BONUS. A crowd, a horde and a survival boss are not a duel: their blows land as they always did.
    const duel = !crowd && !target.kit && !attacker?.kit;
    const marks = own ?? (duel && castId !== undefined ? this.projectiles.find(s => s.castId === castId && s.actorId === actorId) : undefined);
    const scaled = crowd ? 1 : duel && move.ender ? 1 - (1 - damageScale(target.scalingHits)) * ENDER_SCALING : damageScale(target.scalingHits);
    // Techniques (techniques.ts): fighter against fighter, a combo built from more kinds of technique is worth more blow
    // by blow - a string mashed on its own stays itself - and a bot reads the casts it is made of (familiarity).
    let style = 1;
    if (duel && attacker && attacker !== target) {
      target.comboKinds |= KIND_BIT[comboKind(slot, own?.branch, !!own?.airborne)];
      style = styleScale(bitCount(target.comboKinds));
      // (Each cast once, by its id: a string's stages share one opening for the breaker's budget.)
      const cast = `${actorId}:${castId ?? ''}`;
      if (cast !== target.routeCast && target.routeNow.length < ROUTE_CHARS) { target.routeCast = cast; const sig = `${slot[0]}${own?.branch ?? (own ? own.stage : stage)}`; target.routeNow = target.routeNow ? `${target.routeNow}.${sig}` : sig; }
    }
    const standing = damage * scaled * style * (duel && marks?.beat ? RHYTHM_BONUS : 1) * (duel && marks?.mash ? MASH_SCALE : 1);
    // Ground hits 2: a normal on a body down on the floor is worth less with each ground hit of its stay there, and the
    // stay costs GROUND_HIT_BUDGET in all (moves.ts groundHitDamage) - after the string's scaling. Past it, a hit lands
    // for nothing.
    damage = floored ? groundHitDamage(standing, target.floorHits, target.floorTaken, p.maxHp) : Math.max(1, Math.round(standing));
    if (floored) { target.floorHits++; target.floorTaken += damage; }
    target.lastDamageAt = this.serverTime;
    const hpBefore = p.hp;
    p.hp = Math.max(0, p.hp - damage);
    this.tally(target, attacker, hpBefore - p.hp);
    p.guarding = false;
    // Whatever they were doing in the air, it is not a jump any more.
    // Round 4b (JUMP): nor is its climb - a jump leaves the floor at over twenty metres a second now, and a body hit
    // on the way up and left to plain gravity rose another ten metres.
    if (target.jumping) target.vy = Math.min(target.vy, AIR_CAST_RISE);
    target.jumping = false;
    // Attack armour. A committed attacker is only knocked out of their move by
    // a special, an ultimate or a guard break; a light or heavy trades instead.
    // Poise: a boss or a brute takes a number of blows without being moved by
    // them - hurt, not staggered - and the one that empties it opens it wide.
    const poise = target.poiseMax && p.hp > 0 && !guardBreak ? this.spendPoise(target, damage, slot) : 'open';
    const poised = poise === 'poised';
    // The blow that empties it knocks them out of whatever they were doing.
    // A horde blow on a fighter it has just staggered only chips (MINOR_GRACE).
    const graced = minor && !target.kit && this.serverTime < (target.minorArmourUntil ?? -Infinity) && !guardBreak;
    // Lock combat: a light or heavy is not armoured against one - the first to land wins the exchange, rather than both.
    const unarmoured = !!target.cast && this.lockSwing(target);
    const armoured = graced || poised || poise !== 'broken' && !!target.cast && target.armour !== false && p.hp > 0 && !breaksArmour(slot, target.cast.slot) && !guardBreak && !unarmoured;
    // Lock combat: caught in the swing before its blow, a COUNTER.
    const counter = !armoured && !floored && !crowd && unarmoured && target.cast!.nextContact === 0 && !!attacker && attacker !== target;
    if (minor && !armoured) target.minorArmourUntil = this.serverTime + MINOR_GRACE;
    // Hit out of it, the string they were throwing is over as well.
    if (!armoured) { target.cast = null; target.dashUntil = 0; target.rushUntil = -Infinity; }
    const stun = own?.countered ? COUNTER_STUN : finisher ? move.finisherStun ?? move.stun : move.stun;
    const n = Math.hypot(fromX, fromZ) || 1;
    const knockback = finisher ? move.finisherKnockback ?? move.knockback : move.knockback;
    // What the hit does to them. A mid-combo tick flinches, a clean finisher
    // staggers, a heavy blow takes them off their feet, a broken guard dizzies.
    // The combo-breaker escape outranks the launch: its whole purpose is to
    // hand control back, and being put in the air would take it away again.
    // Never mid-cast: a breaker inside an eight-hit barrage would hand out a
    // quarter second of invulnerability in the middle of it. On a cast's
    // first contact, or on its last.
    // Ground hits: not on a body down on the floor - getting up is its escape -
    // though the cast is charged to the budget all the same.
    const escaped = !floored && !crowd && target.breaker !== false && target.chainHits >= (attacker && this.locking(attacker) ? LOCK_BREAK_CASTS : BREAK_CASTS) && (opening || finisher);
    // Anything that connects on someone already off the floor keeps them there.
    // A juggle is the point of a launcher, so it does not need a finisher or a
    // knockback threshold - only a budget, which MAX_JUGGLE provides.
    // Ground hits: a body down never goes up again off a ground hit - not off a
    // ledge it slid off, not off a launcher, not off an outcome of the blow's.
    const juggling = !floored && !armoured && !escaped && !p.grounded && p.hp > 0 && target.juggleHits < MAX_JUGGLE;
    // Round 3e (VARIETY): the move's own outcome, where it has one (shapeBlow).
    const shaped = floored ? undefined : this.outcomeOf(target, move, finisher && !armoured && !escaped && !guardBreak && p.hp > 0);
    const launches = !floored && !target.anchored && (juggling || (!armoured && !escaped && finisher && (shaped && shaped !== 'spent' ? LAUNCHING.has(shaped) : knockback >= LAUNCH_KNOCKBACK) && p.hp > 0));
    const broken = poise === 'broken';
    // A string's dizzy (combos.ts: Light x3 + Special) is a guard break's stun, earned by the string.
    const dizzy = shaped === 'dizzy' && !launches;
    // Ground hits: a flinch where it lies - the body keeps the reaction it is down in (see below).
    const reaction: ReactionKind = floored ? 'flinch' : guardBreak || dizzy ? 'stun' : launches ? 'launched' : broken ? 'stun' : !finisher || escaped ? 'flinch' : 'hurt';
    // What landing a hit is worth. Hitstun is floored at the wind-up the
    // attacker paid plus the advantage the slot is owed, capped, so a normal
    // that connects leaves its thrower ahead instead of a tenth of a second
    // behind. Scoped to a melee finisher that is not feeding a juggle: a
    // barrage tick and an airborne target already have their own answer.
    //
    // A light whose string goes on is floored at what the NEXT stage needs to
    // land, not at what this one paid: the finisher contacts at 0.38 s against
    // the jab's 0.2, and a floor read off the stage before it handed the
    // target a turn in the middle of every rush. Nor does the hitstun decay
    // take it away - a started string is a true string; the breaker and the
    // decay on everything else are what end long combinations.
    //
    // A late shot from an earlier stage - Ouga's second blast, landing once
    // the punch after it is already out - holds them for that stage's
    // contact instead, which is what the string is waiting on by then. It
    // used to reset their stun to a ki blast's and hand them a turn.
    const follow = own && slot === 'light' ? this.rushFollow(attacker!, own) : undefined;
    const pending = !own && slot === 'light' && attacker?.cast?.slot === 'light' && attacker.cast.nextContact === 0 ? attacker.cast : undefined;
    const linkTo = follow ? Math.max(own!.move.contacts[0], follow.contacts[0])
      : pending ? pending.start + pending.move.contacts[0] - this.serverTime : undefined;
    const advantage = armoured || guardBreak || !finisher || juggling ? 0
      : linkTo !== undefined ? Math.min(MAX_FLOOR_STUN[slot], linkTo + ADV_ON_HIT[slot])
      : move.style === 'melee' && own ? Math.min(MAX_FLOOR_STUN[slot], own.move.contacts[0] + ADV_ON_HIT[slot]) : 0;
    // Ground hits: the floor's own clock, which a ground hit never resets - it
    // holds the body down GROUND_HIT_HOLD past the blow at most, and never past
    // `floorUntil` (when it would have got up as it went down, and
    // GROUND_HIT_MOST), however many land.
    if (!armoured && floored) target.stunUntil = Math.max(target.stunUntil, Math.min(this.serverTime + GROUND_HIT_HOLD, target.floorUntil));
    else if (!armoured) target.stunUntil = this.serverTime + (dizzy ? move.daze ?? DIZZY_SECONDS : guardBreak ? GUARD_BREAK_STUN
      : linkTo !== undefined ? Math.max(stun * stunScale, advantage) : Math.max(stun, advantage) * stunScale) * (target.mods ? target.mods.stunIn : 1);
    // Round 5 (PARRY): a parried thrower reels for the whole of the stagger
    // whatever lands on them inside it: a punish that opens on a short flinch
    // (Konta's three-blow jab) used to hand the turn back halfway through it.
    if (!armoured && !floored && target.parriedUntil > this.serverTime) target.stunUntil = Math.max(target.stunUntil, target.parriedUntil);
    if (counter && !launches) target.stunUntil += LOCK_COUNTER_STUN;
    // Lock combat (lockCombat.ts): a round's last blow. The body is held to the next blow - the next round's first, or
    // the finisher on its wind-up (LOCK_FINISH_WINDUP) - and has LOCK_ESCAPE_WINDOW to vanish out.
    const roundEnd = !!own && !!attacker && attacker !== target && slot === 'light' && finisher && !own.airborne && !own.branch
      && own.stage === LOCK_ROUND - 1 && this.locking(attacker) && !armoured && !floored && !escaped && !launches && !guardBreak && !dizzy && p.hp > 0;
    // Lock combat: the finisher's blow - the attacker opens nothing new for LOCK_CHASE_HOLD (the chase waits as long).
    if (!!own && !!attacker && attacker !== target && slot === 'light' && finisher && !own.airborne && own.stage >= LOCK_ROUND && this.locking(attacker))
      attacker.lockGapUntil = Math.max(attacker.lockGapUntil, this.serverTime + LOCK_CHASE_HOLD);
    if (roundEnd) {
      const more = (own!.round ?? 0) < LOCK_ROUNDS - 1;
      const awake = !!attacker!.state.awakened, next = lockRoundMove(attacker!.state.fighter, more ? 0 : LOCK_ROUND, awake) ?? rushMove(attacker!.state.fighter, more ? 0 : LOCK_ROUND, awake);
      const beat = 0;
      target.stunUntil = Math.max(target.stunUntil, this.serverTime + Math.min(LOCK_STUN_MOST, beat + next.contacts[0] + ADV_ON_HIT.light));
      attacker!.lockGapUntil = this.serverTime + beat;
      target.lockBy = actorId; target.lockFrom = this.serverTime; target.lockTo = this.serverTime + LOCK_ESCAPE_WINDOW;
      target.lockBarred = this.serverTime - target.guardPressedAt <= LOCK_ESCAPE_EARLY;
    }
    // Poise emptied: whatever this blow was, the body reels for long enough to
    // be punished, and it is announced so the arcade can make it an event.
    if (broken) {
      target.stunUntil = Math.max(target.stunUntil, this.serverTime + POISE_BREAK_STUN);
      target.poiseBrokenUntil = target.stunUntil + POISE_GRACE;
      this.emit({ kind: 'poise-break', actorId: p.id, targetId: actorId, origin: position(p), endpoint: centreOf(p) });
    }
    if (escaped) {
      target.evadeUntil = this.serverTime + BREAK_EVADE; target.stunUntil = this.serverTime + 0.08; target.chainHits = 0;
      // The string is over. Whatever this cast still has to throw is a fresh
      // opening against the budget, not a continuation of a charge already paid.
      opened?.delete(p.id);
    }
    // Lock combat: a body a string is working on turns to face its thrower with each blow (the critic, round 4: Ouga
    // stood with his back to Taisei through the finisher's wind-up; the victim should face Taisei until the string drops).
    if (!!attacker && attacker !== target && slot === 'light' && this.locking(attacker) && !armoured && !floored && !launches && !escaped && p.grounded && p.hp > 0) this.turnTo(p, attacker.state);
    // An armoured fighter is only nudged: shoving them out of their own swing
    // would cancel it by displacement instead of by stun.
    const push = (finisher ? 1 : 0.2) * (armoured ? 0.25 : 1) * (target.mods ? target.mods.knockbackIn : 1);
    if (floored) {
      // Ground hits: shoved along the floor GROUND_HIT_SHOVE at most - under
      // WALL_SPLAT_SPEED, so it never pins them to a wall - and never slowed:
      // a body still skidding from its knockdown skids on.
      const shove = Math.min(GROUND_HIT_SHOVE, knockback * push);
      if (shove > Math.hypot(target.kx, target.kz)) { target.kx = -fromX / n * shove; target.kz = -fromZ / n * shove; target.knockbackDrag = 7; }
    } else {
      target.kx = -fromX / n * knockback * push;
      target.kz = -fromZ / n * knockback * push;
      target.knockbackDrag = slot === 'ultimate' ? 3 : move.style === 'beam' ? 4 : finisher && move.finisherKnockback !== undefined ? 5 : 7;
      // The dream loop's feel pass (v69, moves.ts STRING_SHOVE): a string's blow before its finisher shoves the body back
      // a step, and the next stage's approach follows it.
      // (Only ever further: what a body slides is its speed over its drag; and only where the thrower can follow.)
      if (slot === 'light' && finisher && stage < RUSH_STAGES - 1 && !launches && !armoured && move.style === 'melee'
        && STRING_SHOVE > knockback * push / target.knockbackDrag && attacker && this.roomToFollow(attacker, target, slot, move)
        && (!this.locking(attacker) || this.shoveFits(target, -fromX / n, -fromZ / n))) {
        const shove = STRING_SHOVE * STRING_DRAG;
        target.kx = -fromX / n * shove; target.kz = -fromZ / n * shove; target.knockbackDrag = STRING_DRAG;
      }
    }
    if (escaped) {
      // The combo breaker, which until now happened in silence: the sixth hit
      // of a string simply passed through a body standing in front of you.
      // It shoves the pair apart and freezes both, and it is announced so it
      // can be seen and heard. Written after the knockback above, which would
      // otherwise overwrite it. The attacker's half is a freeze rather than a
      // stun because the breaker is automatic - it is not a resource the
      // defender spent, so it must not be a free punish - and because a freeze
      // hands the body back without deleting a cast the client has already
      // predicted, which a stun or a cleared cast would.
      target.kx = -fromX / n * BREAK_PUSH; target.kz = -fromZ / n * BREAK_PUSH;
      target.knockbackDrag = 9; target.mx = target.mz = 0;
      this.freeze(target, BREAK_FREEZE);
      if (attacker) this.freeze(attacker, BREAK_FREEZE);
      // At the feet of the fighter getting out, not at the blow: the escape is
      // theirs, and the ring the client draws sits on the floor under them.
      this.emit({ kind: 'break', actorId: p.id, targetId: actorId, fighter: p.fighter, slot,
        origin: position(p), endpoint: centre(p), contactIndex });
    }
    if (launches) {
      if (juggling) {
        // Each juggle hit lifts less than the last, so a string in the air ends
        // on its own rather than holding someone up until their health runs out.
        target.juggleHits++;
        const lift = JUGGLE_LIFT * Math.max(.25, 1 - (target.juggleHits - 1) * JUGGLE_DECAY);
        // A body already thrown keeps its rise where it is faster than the lift; one rising on its own - a jump, a dash -
        // is lifted, not carried on at its own speed under a launch's lighter gravity: Setsu caught rising 15 m/s out of
        // his dash by Gorai's area blow climbed to 8.6 m (tests/jumpArc, the twelve-bot royale).
        target.vy = target.reaction === 'launched' ? Math.max(target.vy, lift) : lift;
        // An air string rides its juggle: the fighter throwing it from the
        // air is carried up with the body it lifts, so the next stage is still
        // level with them instead of a metre and a half underneath. Solved to
        // be level again by the next blow (JUGGLE_RIDE_AHEAD): the thrower
        // falls at AIR_CAST_GRAVITY and the body at LAUNCH_GRAVITY, so riding
        // at the body's own speed floated the thrower up to a metre above it.
        if (own && attacker && !attacker.state.grounded && (move.style === 'melee' || slot === 'light')) {
          const t = JUGGLE_RIDE_AHEAD, level = target.vy + (p.y - attacker.state.y) / t - .5 * 23 * (LAUNCH_GRAVITY - AIR_CAST_GRAVITY) * t;
          // Round 4b (JUMP): the juggle carries it now, not its jump - nor the jump's climb (see AIR_CAST_RISE).
          attacker.vy = Math.max(attacker.jumping ? Math.min(attacker.vy, AIR_CAST_RISE) : attacker.vy, clamp(level, 0, target.vy + 2));
          attacker.jumping = false;
        }
      } else {
        // Enough hang time to chase and juggle, rather than a bump and a recovery.
        target.juggleHits = 0;
        target.vy = slot === 'ultimate' ? 11 : slot === 'special' ? 9 : 7.5;
      }
      p.grounded = false; target.launchSlot = slot;
      // Sending somebody flying opens the chase: a dash inside CHASE_WINDOW
      // goes after them, from the ground as well as from the air.
      // A kit body has no chase: its brain decides where it goes.
      if (attacker && attacker !== target && p.hp > 0 && !attacker.kit) {
        attacker.chaseTargetId = p.id; attacker.chaseUntil = this.serverTime + CHASE_WINDOW;
        // The rush finisher and a heavy open it on the light button as well:
        // mashing light after either chases instead of swinging under them.
        attacker.lightChaseUntil = slot === 'heavy' || (slot === 'light' && stage >= RUSH_STAGES - 1)
          ? this.serverTime + LIGHT_CHASE_WINDOW : -Infinity;
      }
    }
    // A finisher that catches someone already off the floor drives them into
    // it, and they bounce once on the way down.
    if (!floored && !armoured && !escaped && finisher && airborneBefore && p.hp > 0 && slot !== 'light') {
      target.bounceOnLand = true;
    }
    if (!armoured && !floored) this.shapeBlow(target, shaped, move, fromX / n, fromZ / n, juggling, launches, attacker, slot === 'light' && stage < RUSH_STAGES - 1); // Round 3e (VARIETY); round 4b: a string's pop
    // Lock combat: the finisher knocks the body away low and long (lockKnockaway), and no blow of a string drives it into
    // a wall (lockClear) - after the blow's own shape, which can send it straight up (Ouga's Double Axe Handle).
    if (target.lockSlide) delete target.lockSlide;
    if (slot === 'light' && !!attacker && attacker !== target && this.locking(attacker) && !armoured && !floored) {
      const knockaway = finisher && !!own && !own.airborne && own.stage >= LOCK_ROUND;
      if (!knockaway) target.lockSlide = true;
      if (knockaway && launches) this.lockKnockaway(target, -fromX / n, -fromZ / n);
      this.lockClear(target, knockaway);
    }
    // The stagger plays at the speed it was authored at and then holds its last
    // pose. The floor above can double a light's hitstun, and the client remaps
    // the hurt clip onto actionDuration, so handing it the whole window plays
    // the flinch at half speed and the advantage arrives as a floaty stagger.
    // Ground hits: a body down keeps the reaction it is down in, and its pose's
    // clock - the flinch is drawn where it lies (the event's `downed`).
    if (!armoured && !floored) {
      target.reaction = reaction;
      target.reactionClip = Math.max(.05, stun * 1.25);
      const hold = Math.max(.05, target.stunUntil - this.serverTime);
      this.action(target, reaction, reaction === 'flinch' || reaction === 'hurt' ? Math.min(hold, target.reactionClip) : hold, true);
    }
    // Two meters, filled from opposite ends of the same blow. The one who
    // took it builds toward their transformation; the one who landed it
    // builds toward their ultimate. The victim used to get a sliver of the
    // ultimate bar as well, which is gone: the ultimate is earned by hitting.
    p.awakening = Math.min(100, (p.awakening ?? 0) + damage * AWAKENING_PER_DAMAGE * (target.mods ? target.mods.awakenGain : 1));
    const source = attacker?.state;
    // An awakened fighter still builds toward the next one; they simply cannot
    // spend it until this window closes.
    if (source && slot !== 'ultimate') source.ultimate = Math.min(100, source.ultimate + damage * ULTIMATE_PER_DAMAGE * (move.detached ? DETACHED_METER : 1) * (attacker?.mods ? attacker.mods.meterGain : 1));
    // Arcade lifesteal: a share of what actually came off heals the thrower.
    if (source?.alive && attacker?.mods?.lifesteal && attacker !== target) source.hp = Math.min(source.maxHp, source.hp + (hpBefore - p.hp) * attacker.mods.lifesteal);
    // Impact freeze, on both fighters and deliberately not symmetric: the
    // defender holds longer than the attacker, which is where the frame
    // advantage above is actually felt, and a heavier blow holds longer still.
    // A non-finisher tick is capped at a third of the gap to the next contact,
    // so KoKo's eight-hit GAN reads as a barrage rather than as a stutter.
    const gap = contactIndex !== undefined && contactIndex + 1 < move.contacts.length
      ? move.contacts[contactIndex + 1] - move.contacts[contactIndex] : Infinity;
    // The feel pass: a special's, an ultimate's, an ender's and a rush
    // finisher's last blow between two fighters holds both of them longer
    // (BIG_HITSTOP); everything else - and every crowd, horde and boss - as it was.
    // The thrower keeps the hold every blow gives them, so a chase, a cancel and a string's rhythm off a big blow are
    // exactly as they were; the struck body is the one held longer.
    const big = duel && isBigBlow(slot, own?.branch ?? (move.ender ? true : undefined), stage, finisher);
    const bigStop = !big ? 0 : slot === 'special' ? BIG_HITSTOP.special : slot === 'ultimate' ? BIG_HITSTOP.ultimate : own?.branch || move.ender ? BIG_HITSTOP.ender : BIG_HITSTOP.finisher;
    const stop = finisher ? move.hitstop ?? HITSTOP[slot] : Math.min(HITSTOP[slot] * .6, gap * .3);
    // A blow that launches into a juggle takes BIG_LAUNCH_MOST more at most: its air string and its chase are timed off
    // the launch, and a longer hold would move every juggle the roster has.
    // (v70: a combo ender's body is held BIG_ENDER_HOLD at most, then thrown; a special's, an ultimate's and a rush
    // finisher's keep their hold - the finisher's tumble is laid along it: tests/reactionTakes.)
    const throws = big && !!(own?.branch || move.ender) && slot !== 'special' && slot !== 'ultimate';
    // (v75: an air strike that flings holds its body AIR_FLING.hold - a beat at the blow - before the throw.)
    const held = throws ? Math.min(stop, move.fling ? AIR_FLING.hold : BIG_ENDER_HOLD) : big ? Math.max(stop, Math.min(bigStop, reaction === 'launched' ? stop + BIG_LAUNCH_MOST : bigStop)) : stop;
    // Ground hits: the body lying there is not held - its pose holds still on
    // its own, and a freeze would hold its floor clock past `floorUntil`. The
    // thrower holds as for any blow.
    if (!(minor && armoured) && !floored) this.freeze(target, held * clamp(.7 + damage / 200, .75, 1.25));
    if (roundEnd) {
      // Announced once the freeze is known: the window opens as the body comes out of it.
      // The window runs from the end of this blow's own freeze, on the clock: it is not held through the freezes of the
      // blows that follow it (the string runs on without a pause), or a press after it shut still escaped.
      target.lockTo = Math.max(this.serverTime, target.hitstopUntil) + LOCK_ESCAPE_WINDOW;
      if (p.isBot && !target.external) this.botLockEscape(target);
      this.emit({ kind: 'lock-gap', actorId, targetId: p.id, fighter: attacker!.state.fighter, round: own!.round ?? 0,
        due: target.lockTo, ...(target.lockBarred ? { reason: 'early' } : {}) });
    }
    if (attacker) {
      if (!move.detached) this.freeze(attacker, stop * .6);
      attacker.state.combo = this.serverTime < attacker.comboUntil ? (attacker.state.combo ?? 0) + 1 : 1;
      attacker.comboUntil = this.serverTime + COMBO_WINDOW;
    }
    this.emit({ kind: 'hit', actorId, targetId: p.id, fighter: source?.fighter, slot, actionSeq:own?attacker!.state.actionSeq:undefined,
      chain: slot === 'light' ? stage : undefined, ...(own?.branch ? { branch: own.branch } : {}), move: move.name, damage, origin: position(origin), endpoint: centreOf(p), contactIndex,
      ...(style > 1 ? { style: +style.toFixed(2) } : {}), combo: attacker?.state.combo, reaction: armoured && poised ? undefined : reaction, fromBehind: !front, ...(critical ? { critical } : {}),
      ...(area?.bullseye ? { bullseye: true } : {}),
      ...(shaped && shaped !== 'spent' && !armoured && (!juggling || shaped === 'groundBounce' || shaped === 'wallBounce') ? { outcome: shaped } : {}),
      ...(target.launchLead > 0 && target.launchRun === 0 ? { lift: target.vy } : {}),
      ...(floored ? { downed: true } : {}), ...(counter ? { counter: true } : {}),
      ...(own?.round && slot === 'light' ? { round: own.round } : {}) });
    if (finisher && move.status && p.hp > 0) this.afflict(target, actorId, move.status);
    if (p.hp === 0) this.eliminate(target, actorId);
  }

  /** A landed finisher's status on its victim (VOL.3 part two): refreshed, never stacked. A freeze holds the body as a
   *  stun does, then leaves it FREEZE_IMMUNITY seconds before another can take hold. */
  private afflict(target: Actor, fromId: string, status: NonNullable<MoveDefinition['status']>) {
    const now = this.serverTime, s = target.statuses ??= {};
    // A burn lit again runs on from its own next tick: lit faster than it ticks, it would otherwise never tick.
    if (status.kind === 'burn') s.burn = { until: now + status.seconds, dps: status.dps ?? 0, from: fromId, next: s.burn?.next ?? now + BURN_TICK };
    else if (status.kind === 'slow') s.slow = { until: now + status.seconds, factor: status.factor ?? 1 };
    else if (now >= (s.immuneUntil ?? 0)) {
      s.freeze = { until: now + status.seconds }; s.immuneUntil = now + status.seconds + FREEZE_IMMUNITY;
      target.stunUntil = Math.max(target.stunUntil, now + status.seconds);
    } else return;
    this.emit({ kind: 'status', actorId: fromId, targetId: target.state.id, fighter: target.state.fighter, status: status.kind });
    this.showStatus(target);
  }
  /** A burn's ticks (never the last HP point, counted to whoever lit it) and the ends of every status. */
  private tickStatus(a: Actor) {
    const s = a.statuses!, now = this.serverTime, p = a.state;
    while (s.burn && now >= s.burn.next && s.burn.next <= s.burn.until + 1e-9) {
      const before = p.hp;
      p.hp = Math.max(1, p.hp - Math.round(s.burn.dps * BURN_TICK));
      this.tally(a, this.actors.get(s.burn.from), before - p.hp);
      s.burn.next += BURN_TICK;
    }
    if (s.burn && now >= s.burn.until) delete s.burn;
    if (s.slow && now >= s.slow.until) delete s.slow;
    if (s.freeze && now >= s.freeze.until) delete s.freeze;
    this.showStatus(a);
    if (!s.burn && !s.slow && !s.freeze && now >= (s.immuneUntil ?? 0)) delete a.statuses;
  }
  private showStatus(a: Actor) {
    const s = a.statuses, kinds = s ? (['burn', 'slow', 'freeze'] as const).filter(kind => s[kind]) : [];
    if (kinds.length) a.state.status = [...kinds]; else delete a.state.status;
  }
  /** How fast a slowed body runs, against its own speed. */
  private slowOf(a: Actor) { const slow = a.statuses?.slow; return slow && this.serverTime < slow.until ? slow.factor : 1; }

  /** Ground hits (moves.ts GROUND_HIT_SCALE): down on the floor - a knockdown,
   *  however it got there, or a wall splat come down onto the floor - where a
   *  fighter's normal is a ground hit. */
  private down(t: Actor) { return t.reaction === 'knockdown' || t.reaction === 'splat' && t.state.grounded; }

  /** Ground hits: whether a blow is one fighter's on another - the roster on
   *  both ends, thrown by somebody, not a horde's or a crowd's - which the
   *  floor's rule since 8 October governs. Anything else (arcade survival's
   *  horde and bosses, Last Stand's raiders, a hazard) keeps the old one. */
  private fighterBlow(attacker: Actor | undefined, target: Actor, minor = false, crowd = false) {
    return !!attacker && attacker !== target && !attacker.kit && !target.kit && !minor && !crowd;
  }

  private floorDodges(t: Actor, slot: AttackSlot, fighters: boolean) {
    if (t.reaction === 'getup') return !fighters || slot !== 'ultimate';
    return !fighters && t.reaction === 'knockdown';
  }

  /** A blow landing on a horde body (see ExternalTargets). Everything on the
   *  thrower's side is the arena's, exactly as `hit` does it for a fighter:
   *  the cancel the connection opens, the critical roll and the thrower's
   *  mods, the ultimate meter (at EXTERNAL_METER - a crowd is a lot of
   *  bodies), lifesteal, the combo count, one impact freeze per tick however
   *  many bodies a swing passes through, and the `hit` event. What the blow
   *  does to the body - how far it flies, whether it goes up, whether it
   *  dies - is the horde's. True when it landed. */
  private hitExternal(actorId: string, body: ExternalBody, slot: AttackSlot, move: MoveDefinition, origin: Vec3, finisher: boolean, contactIndex?: number, castId?: number, stage = 0, area?: AreaBlow) {
    const attacker = this.actors.get(actorId);
    const own = attacker?.cast && castId !== undefined && attacker.cast.id === castId ? attacker.cast : undefined;
    let damage = (finisher ? move.finisherDamage ?? move.damage : move.damage) * (area?.scale ?? 1) * (attacker?.state.awakened ? AWAKENED_DAMAGE : 1);
    let critical = false;
    if (attacker?.mods) {
      damage *= attacker.mods.damageOut;
      if (attacker.mods.crit && this.random() < attacker.mods.crit) { critical = true; damage *= attacker.mods.critDamage; }
    }
    const knockback = finisher ? move.finisherKnockback ?? move.knockback : move.knockback;
    const stun = finisher ? move.finisherStun ?? move.stun : move.stun;
    let pushX = body.x - origin.x, pushZ = body.z - origin.z;
    const n = Math.hypot(pushX, pushZ);
    if (n < 1e-3) { pushX = Math.sin(attacker?.state.yaw ?? 0); pushZ = Math.cos(attacker?.state.yaw ?? 0); } else { pushX /= n; pushZ /= n; }
    const gap = contactIndex !== undefined && contactIndex + 1 < move.contacts.length ? move.contacts[contactIndex + 1] - move.contacts[contactIndex] : Infinity;
    const hitstop = finisher ? move.hitstop ?? HITSTOP[slot] : Math.min(HITSTOP[slot] * .6, gap * .3);
    const result = this.external!.receive(body, { attackerId: actorId, slot, move, damage: Math.max(1, Math.round(damage)), critical, finisher,
      pushX, pushZ, knockback, stun, launch: body.airborne || (finisher && knockback >= LAUNCH_KNOCKBACK), hitstop });
    if (!result) return false;
    if (own) own.connected = true;
    const source = attacker?.state;
    if (attacker && source) {
      source.damageDealt = (source.damageDealt ?? 0) + result.damage;
      if (slot !== 'ultimate') source.ultimate = Math.min(100, source.ultimate + result.damage * ULTIMATE_PER_DAMAGE * EXTERNAL_METER * (move.detached ? DETACHED_METER : 1) * (attacker.mods ? attacker.mods.meterGain : 1));
      if (source.alive && attacker.mods?.lifesteal) source.hp = Math.min(source.maxHp, source.hp + result.damage * attacker.mods.lifesteal);
      if (!move.detached && attacker.externalFreezeTick !== this.tick) { attacker.externalFreezeTick = this.tick; this.freeze(attacker, hitstop * .6); }
      source.combo = this.serverTime < attacker.comboUntil ? (source.combo ?? 0) + 1 : 1;
      attacker.comboUntil = this.serverTime + COMBO_WINDOW;
    }
    this.emit({ kind: 'hit', actorId, targetId: body.id, fighter: source?.fighter, slot, actionSeq: own ? attacker!.state.actionSeq : undefined,
      chain: slot === 'light' ? stage : undefined, move: move.name, damage: result.damage, origin: position(origin),
      endpoint: { x: body.x, y: body.y + body.height * .55, z: body.z }, contactIndex, combo: source?.combo, reaction: result.reaction,
      ...(critical ? { critical } : {}), ...(area?.bullseye ? { bullseye: true } : {}) });
    return true;
  }

  /** Charge a blow against a body's poise. 'poised' while any is left after
   *  it (the blow hurts and does not move them), 'broken' on the blow that
   *  empties it, 'open' while it is empty and the body is there to be hit.
   *  Heavier slots break poise faster than they do health. */
  private spendPoise(target: Actor, damage: number, slot: AttackSlot): 'poised' | 'broken' | 'open' {
    const left = target.poise ?? 0;
    if (left <= 0) return 'open';
    target.poise = Math.max(0, left - damage * POISE_SLOT[slot]);
    target.state.poise = target.poise / (target.poiseMax || 1);
    return target.poise > 0 ? 'poised' : 'broken';
  }
  /** Poise comes back: all at once when a stagger it opened is over, slowly
   *  while nobody is hitting it. */
  private regainPoise(a: Actor, dt: number) {
    const max = a.poiseMax ?? 0, left = a.poise ?? 0;
    if (left >= max) return;
    if (left <= 0) { if (this.serverTime >= (a.poiseBrokenUntil ?? 0)) a.poise = max; }
    else if (this.serverTime - a.lastDamageAt > POISE_REGEN_DELAY) a.poise = Math.min(max, left + max * POISE_REGEN * dt);
    a.state.poise = (a.poise ?? 0) / (max || 1);
  }

  /** Round 3e (VARIETY): the outcome a finisher gives the body it lands on
   *  (moves.ts Outcome), when `eligible` - it landed whole, on a body still
   *  standing, with no guard break or combo breaker to outrank it. Undefined
   *  goes by the old rule (a launch from LAUNCH_KNOCKBACK up). A throw is
   *  none for an anchored body, or for one already in the air whose juggle
   *  budget is spent (a fresh throw would hand it back). 'spent' is a stagger
   *  or a spin-out on a body that was staggered inside STAGGER_GUARD: it is
   *  hurt, briefly, and no more - one stagger opens one follow-up. */
  private outcomeOf(t: Actor, move: MoveDefinition, eligible: boolean): Outcome | 'spent' | undefined {
    const outcome = move.outcome;
    if (!outcome || !eligible) return undefined;
    if (LAUNCHING.has(outcome) && (t.anchored || !t.state.grounded && t.juggleHits >= MAX_JUGGLE)) return undefined;
    if ((outcome === 'stagger' || outcome === 'spin') && this.serverTime - (t.staggeredAt ?? -Infinity) < STAGGER_GUARD) return 'spent';
    // A string's dizzy (combos.ts) dazes a body once in DIZZY_GUARD: the next is a stagger's brief hurt.
    if (outcome === 'dizzy' && this.serverTime - (t.dizzyAt ?? -Infinity) < DIZZY_GUARD) return 'spent';
    return outcome;
  }

  /** Round 3e (VARIETY): what a blow's outcome does to the body, on top of
   *  what `hit` has already done - the stun, the push along the line of the
   *  blow (`toX`, `toZ` point from the body back at the blow) and, for a
   *  throw, the launch and the chase it opens. Called for every blow that
   *  lands unarmoured, so each clears what the last left unless it leaves
   *  something of its own. Deterministic: the client predicts with it. */
  private shapeBlow(t: Actor, shaped: Outcome | 'spent' | undefined, move: MoveDefinition, toX: number, toZ: number, juggling: boolean, launched: boolean, attacker?: Actor, stringStage = false) {
    const p = t.state;
    t.spinLeft = 0;
    // Round 4b (COMBAT): popped off its feet by a stage before its string's finisher, it lands still in the string
    // (POP_LAND_STUN). Every blow says so afresh: one that catches it in the air takes the pop over - as does the
    // kind of knockdown it is landing from.
    t.popLand = stringStage && shaped === 'hop' && launched && !juggling && !t.kit; // (a survival body lands as it did)
    t.knockKind = shaped === 'knockdown' && (move.knock === 'spike' || move.knock === 'slide') ? move.knock : '';
    if (shaped === 'spent') { t.stunUntil = Math.min(t.stunUntil, this.serverTime + STAGGER_SPENT); return; }
    if (juggling) {
      // Already in the air it is juggled as ever, and keeps the floor time the
      // throw that put it there gave it. A spike drives it down into a bounce;
      // a blow-back still comes back off a wall.
      // v72: driven down hard (moves.ts AIR_SPIKE_DRIVE), off the floor and up again - it drifted down at 6 m/s for
      // half a second, and the dream loop's critics saw the air strike's body "pinned at the contact point".
      // v75: and an air strike that flings (MoveDefinition.fling) throws it down and away along the blow instead, on a long
      // arc the camera keeps (moves.ts AIR_FLING); it bounces off the floor all the same.
      if (shaped === 'groundBounce' && move.fling) { t.vy = Math.min(t.vy, -AIR_FLING.down); t.kx = -toX * AIR_FLING.away; t.kz = -toZ * AIR_FLING.away; t.knockbackDrag = AIR_FLING.drag; t.bounceOnLand = true; }
      else if (shaped === 'groundBounce') { t.vy = Math.min(t.vy, -AIR_SPIKE_DRIVE); t.bounceOnLand = true; }
      // A knockdown (combos.ts) slams a body in the air straight down, and down it stays: no bounce, and the
      // juggle is over.
      // Round 4b (COMBAT): for its own time (MoveDefinition.down), and in its own way (knock): a spike bounces it once
      // off the floor, a slide or a splat drives it down less steeply and keeps it travelling.
      else if (shaped === 'knockdown') {
        const along = move.knock === 'slide' || move.knock === 'splat';
        t.vy = Math.min(t.vy, along ? -5 : -9); t.bounceOnLand = move.knock === 'spike'; t.downFor = move.down ?? OUTCOME_DOWN.knockdown; t.juggleHits = MAX_JUGGLE;
        if (along) t.knockbackDrag = KNOCK_DRAG[move.knock as 'slide' | 'splat'];
      }
      // A dizzy in the air (combos.ts): driven down, it lands on its feet, dazed (see the landing) - for its own time.
      else if (shaped === 'dizzy') { t.vy = Math.min(t.vy, -7); t.bounceOnLand = false; t.dizzyOnLand = true; t.dizzyAt = this.serverTime; t.juggleHits = MAX_JUGGLE; t.dazeFor = move.daze ?? 0; }
      else if (shaped === 'wallBounce') { t.wallBounce = true; t.wallBounceBy = attacker?.state.id; t.knockbackDrag = 4; }
      else if (!shaped) t.wallBounce = false;
      return;
    }
    t.downFor = undefined; t.wallBounce = false; t.wallBounceBy = undefined;
    if (!shaped) return;
    if (shaped === 'stagger') { t.staggeredAt = this.serverTime; t.knockbackDrag = 9; return; }
    // A string's dizzy (combos.ts): held where it stands, dazed - `hit` gives it the guard break's stun for
    // DIZZY_SECONDS.
    if (shaped === 'dizzy') { t.dizzyAt = this.serverTime; t.knockbackDrag = 12; return; }
    if (shaped === 'spin') {
      // Sent off to one side of the blow's line, turning as it goes: one
      // whole turn over SPIN_SECONDS, the way the push goes round. The side
      // alternates by which way the body faced the blow, so it is fixed by
      // the state and the replay agrees.
      t.staggeredAt = this.serverTime;
      const side = Math.sin(p.yaw) * toZ - Math.cos(p.yaw) * toX >= 0 ? 1 : -1, turn = SPIN_ANGLE * side;
      const c = Math.cos(turn), s = Math.sin(turn);
      const kx = t.kx * c + t.kz * s, kz = -t.kx * s + t.kz * c;
      t.kx = kx; t.kz = kz; t.knockbackDrag = 6;
      t.spinLeft = TAU; t.spinRate = side * TAU / SPIN_SECONDS;
      return;
    }
    if (!launched) return;
    t.downFor = move.down ?? OUTCOME_DOWN[shaped]; // Round 4b (COMBAT): an ender's own floor time
    if (shaped === 'groundBounce') {
      // Driven into the floor it is already standing on: it comes up off it
      // at once, and the bounce is announced where it struck.
      t.vy = move.lift ?? OUTCOME_LIFT.groundBounce; t.kx *= .5; t.kz *= .5; t.bounceOnLand = false; t.launchLead = 0;
      this.emit({ kind: 'ground-bounce', actorId: p.id, fighter: p.fighter, origin: position(p) });
      return;
    }
    t.vy = move.lift ?? OUTCOME_LIFT[shaped];
    // v70: a true launch throws its body ahead of its arc, back on it at the top (moves.ts LAUNCH_LEAD).
    if (shaped === 'launch' && t.vy > 0) { t.launchSpan = t.vy / (23 * LAUNCH_GRAVITY); t.launchLead = LAUNCH_LEAD * t.vy * t.launchSpan; t.launchRun = 0; }
    else t.launchLead = 0;
    // A knockdown's short fall is not a juggle: the string ends on the floor.
    if (shaped === 'knockdown') {
      t.juggleHits = MAX_JUGGLE;
      // Round 4b (COMBAT): the fighter's own knockdown (MoveDefinition.knock). A spike bounces once off the floor
      // before it stays down; a slide skids away low along it; a splat flies back flat into whatever is behind - a
      // wall holds it (the wall splat).
      // v71: a spike on a body standing is driven into the floor it stands on: it goes down where it was struck - no
      // lift, its push cut as a landing's bounce cuts it, on the floor the next tick (and down for the move's own time,
      // as any knockdown lands) - and the floor is struck there at once ('ground-bounce': the dust, the shake, the
      // thud). Thrown up and back first (OUTCOME_LIFT), it bounced off the floor two metres away: "thrown up and
      // sideways as a rigid horizontal body rather than driven into the floor" (the dream loop's critic, 24 October
      // 2026). In the air a spike still drives the body down into its bounce (above).
      if (move.knock === 'spike') {
        t.vy = 0; p.grounded = false; t.bounceOnLand = false; t.kx *= .45; t.kz *= .45; t.launchLead = 0;
        this.emit({ kind: 'ground-bounce', actorId: p.id, fighter: p.fighter, origin: position(p) });
      }
      else if (move.knock === 'slide') { t.vy = move.lift ?? 1.4; t.knockbackDrag = KNOCK_DRAG.slide; }
      else if (move.knock === 'splat') t.knockbackDrag = KNOCK_DRAG.splat;
    }
    if (shaped === 'wallBounce') { t.wallBounce = true; t.wallBounceBy = attacker?.state.id; t.knockbackDrag = 4; }
  }

  /** Round 3e (VARIETY): a body blown into a wall by a wallBounce blow comes
   *  back off it instead of sticking - its speed reflected off the wall at
   *  WALL_BOUNCE_BACK, up into reach at WALL_BOUNCE_LIFT - and whoever threw
   *  it may chase it again. The same test the splat uses: the world refused
   *  most of the move this tick, within 0.8 s of the blow. Announced as a
   *  'wall-splat' with the reaction 'launched', so the wall still reads as
   *  struck. */
  private wallBounceTick(a: Actor, delta: Vec3, wantedX: number, wantedZ: number, corrected: CollisionMovement) {
    const p = a.state;
    if (!a.wallBounce || a.reaction !== 'launched' || this.serverTime - a.lastDamageAt >= .8) return;
    const fromX = wantedX - corrected.x, fromZ = wantedZ - corrected.z;
    const asked = Math.hypot(delta.x, delta.z), given = Math.hypot(p.x - fromX, p.z - fromZ);
    if (asked <= .02 || given >= asked * .55) return;
    a.wallBounce = false;
    // Reflected off the wall's face: the part of the move it refused points
    // into it.
    const rx = delta.x - (p.x - fromX), rz = delta.z - (p.z - fromZ), r = Math.hypot(rx, rz);
    if (r > 1e-4) {
      const nx = rx / r, nz = rz / r, into = a.kx * nx + a.kz * nz;
      a.kx = (a.kx - 2 * into * nx) * WALL_BOUNCE_BACK; a.kz = (a.kz - 2 * into * nz) * WALL_BOUNCE_BACK;
    } else { a.kx *= -WALL_BOUNCE_BACK; a.kz *= -WALL_BOUNCE_BACK; }
    a.knockbackDrag = 5;
    a.vy = Math.max(a.vy, WALL_BOUNCE_LIFT); p.grounded = false; a.launchLead = 0;
    a.downFor = OUTCOME_DOWN.wallBounce;
    a.stunUntil = Math.max(a.stunUntil, this.serverTime + .45);
    this.action(a, 'launched', Math.max(.05, a.stunUntil - this.serverTime), true);
    this.emit({ kind: 'wall-splat', actorId: p.id, fighter: p.fighter, origin: position(p), reaction: 'launched' });
    const by = a.wallBounceBy ? this.actors.get(a.wallBounceBy) : undefined;
    if (by?.state.alive && !by.kit && by !== a && p.hp > 0) {
      by.chaseTargetId = p.id; by.chaseUntil = this.serverTime + CHASE_WINDOW; by.lightChaseUntil = this.serverTime + LIGHT_CHASE_WINDOW;
    }
  }

  /** Round 3e (VARIETY): a spin-out's turn, a tick at a time, while the
   *  body is still reeling from it. Paused by an impact freeze and by stopped
   *  time with everything else (step skips the body then). */
  private spinTick(a: Actor, dt: number) {
    if (!a.reaction) { a.spinLeft = 0; return; }
    const turn = Math.min(a.spinLeft ?? 0, Math.abs(a.spinRate ?? 0) * dt);
    const yaw = a.state.yaw + Math.sign(a.spinRate ?? 0) * turn;
    a.state.yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw));
    a.spinLeft = Math.max(0, (a.spinLeft ?? 0) - turn);
  }

  /** Book the damage a blow actually took off - chip included, and never
   *  more than the health that was there - against both fighters' match
   *  statistics. A hazard has no attacker and books nothing on that side. */
  /** Step the defender of a just guard out of the swing and in behind its
   *  thrower: VANISH_BEHIND past the attacker along the swing, or to either
   *  side of them when a wall or the stage edge leaves no room behind -
   *  cleared with the same capsule sweep and line of sight the fight itself
   *  uses, so nobody vanishes into a building. Facing the attacker's back.
   *  Null when it is cooling down, switched off, or there is nowhere to go;
   *  the parry is then the parry it always was. */
  private vanish(target: Actor, attacker: Actor, escape = false): { from: Vec3; to: Vec3 } | null {
    if (!escape && (!VANISH_ON_JUST_GUARD || this.serverTime - target.vanishedAt < VANISH_COOLDOWN)) return null;
    const p = target.state, q = attacker.state;
    // Past the attacker, away from where the defender stood: against the
    // swing's own direction where there is one, else the line between them.
    const swing = attacker.cast?.direction;
    let ux = swing && Math.hypot(swing.x, swing.z) > .5 ? -swing.x : q.x - p.x;
    let uz = swing && Math.hypot(swing.x, swing.z) > .5 ? -swing.z : q.z - p.z;
    const n = Math.hypot(ux, uz);
    if (n < 1e-4) { ux = -Math.sin(q.yaw); uz = -Math.cos(q.yaw); } else { ux /= n; uz /= n; }
    const { halfX, halfZ } = this.bounds;
    for (const [dx, dz] of [[ux, uz], [uz, -ux], [-uz, ux]]) {
      const wanted = { x: dx * VANISH_BEHIND, y: 0, z: dz * VANISH_BEHIND };
      const moved = this.collision?.move(p.id, q, wanted) ?? wanted;
      const to = { x: clamp(q.x + moved.x, -halfX + PLAYER_RADIUS, halfX - PLAYER_RADIUS), y: q.y + (this.collision ? moved.y : 0),
        z: clamp(q.z + moved.z, -halfZ + PLAYER_RADIUS, halfZ - PLAYER_RADIUS) };
      // Somewhere a body fits beside them, and in sight of them.
      if (Math.hypot(to.x - q.x, to.z - q.z) < PUSH_RADIUS * 2) continue;
      const sight = this.collision?.raycast?.(centre(q), centre(to));
      if (sight && distance(sight, centre(to)) > .1) continue;
      const from = position(p);
      p.x = to.x; p.y = to.y; p.z = to.z; p.grounded = q.grounded;
      p.yaw = Math.atan2(q.x - to.x, q.z - to.z);
      target.vy = 0; target.mx = target.mz = target.kx = target.kz = 0; target.jumping = false;
      target.dashUntil = Math.min(target.dashUntil, this.serverTime);
      target.evadeUntil = Math.max(target.evadeUntil, this.serverTime + VANISH_EVADE);
      target.vanishedAt = this.serverTime; target.vanishOn = q.id;
      return { from, to: position(to) };
    }
    return null;
  }

  /** Lock combat (lockCombat.ts): a guard pressed inside the gap after a round. Clean - not mashed during the round,
   *  with LOCK_VANISH_STAMINA in the bar - it vanishes the defender behind the attacker, out of hitstun, facing their
   *  back; the attacker swung at the afterimage and reels for LOCK_LOST, their string and anything pressed into the
   *  beat spent. Otherwise it says why it did nothing, for the HUD. */
  private lockEscape(a: Actor) {
    const by = this.actors.get(a.lockBy), p = a.state;
    a.lockBy = '';
    if (!by?.state.alive || !p.alive || this.status !== 'active' || a.reaction === 'launched' || this.serverTime >= a.stunUntil) return;
    const q = by.state;
    if (a.lockBarred || p.stamina < LOCK_VANISH_STAMINA) {
      this.emit({ kind: 'lock-escape', actorId: p.id, targetId: q.id, reason: a.lockBarred ? 'early' : 'stamina' }); return;
    }
    const moved = this.vanish(a, by, true);
    if (!moved) return;
    p.stamina -= LOCK_VANISH_STAMINA;
    a.stunUntil = this.serverTime; a.reaction = null; a.blockedUntil = -Infinity; a.juggleHits = 0;
    this.action(a, 'idle', 0, true);
    by.cast = null; by.rushUntil = by.lockGapUntil = by.attackHold = by.attackAt = -Infinity; by.pressQueue = undefined; by.lockRound = 0;
    by.stunUntil = Math.max(by.stunUntil, this.serverTime + LOCK_LOST);
    by.reaction = 'hurt'; by.reactionClip = LOCK_LOST; by.staggeredAt = this.serverTime;
    // A stumble on into the space the defender left, not back into the body now behind them.
    const dx = moved.from.x - q.x, dz = moved.from.z - q.z, n = Math.hypot(dx, dz) || 1;
    by.kx = dx / n * VANISH_STUMBLE; by.kz = dz / n * VANISH_STUMBLE; by.knockbackDrag = 10;
    this.action(by, 'hurt', LOCK_LOST, true);
    // A bot sees its own escape and answers it.
    if (p.isBot) a.nextBotThink = Math.min(a.nextBotThink, this.serverTime + .12);
    // The attacker may answer it in turn (the counter-vanish), a bot now and then.
    by.lockCounterOn = p.id; by.lockCounterUntil = this.serverTime + LOCK_COUNTER_WINDOW;
    if (q.isBot && !by.external && q.stamina >= LOCK_COUNTER_STAMINA
        && this.random() < LOCK_BOT_COUNTER[0] + (LOCK_BOT_COUNTER[1] - LOCK_BOT_COUNTER[0]) * by.botSkill) {
      const press = this.serverTime + Math.max(.04, LOCK_BOT_REACT[0] + (LOCK_BOT_REACT[1] - LOCK_BOT_REACT[0]) * by.botSkill + this.gauss() * LOCK_BOT_SPREAD[1]);
      by.botGuardFrom = press; by.botGuardUntil = press + .12; by.botTimed = true;
    }
    this.emit({ kind: 'vanish', actorId: p.id, targetId: q.id, fighter: p.fighter, slot: 'light', origin: moved.from, endpoint: moved.to });
    this.emit({ kind: 'lock-escape', actorId: p.id, targetId: q.id, fighter: p.fighter, origin: moved.from, endpoint: moved.to });
  }

  /** Lock combat: the counter-vanish. The attacker whose round was escaped presses guard inside LOCK_COUNTER_WINDOW and
   *  is behind the escaper in turn, out of their reel, facing that back; whatever the escaper threw at the space they
   *  left whiffs. Once: the escaper's own vanish is on its cooldown, so it is not a ping-pong. */
  private lockCounter(a: Actor) {
    const on = this.actors.get(a.lockCounterOn), p = a.state;
    a.lockCounterOn = ''; a.lockCounterUntil = -Infinity;
    if (!on?.state.alive || !p.alive || this.status !== 'active' || p.stamina < LOCK_COUNTER_STAMINA) return;
    const moved = this.vanish(a, on, true);
    if (!moved) return;
    p.stamina -= LOCK_COUNTER_STAMINA;
    a.stunUntil = this.serverTime; a.reaction = null; a.parriedUntil = -Infinity;
    this.action(a, 'idle', 0, true);
    if (p.isBot) a.nextBotThink = Math.min(a.nextBotThink, this.serverTime + .1);
    this.emit({ kind: 'vanish', actorId: p.id, targetId: on.state.id, fighter: p.fighter, slot: 'light', origin: moved.from, endpoint: moved.to });
    this.emit({ kind: 'lock-escape', actorId: p.id, targetId: on.state.id, fighter: p.fighter, origin: moved.from, endpoint: moved.to, reason: 'counter' });
  }

  /** Techniques (techniques.ts): a counter stance answers the blow that met it. The blow is undone and its thrower reels
   *  in front of the stance, as a parried thrower does (JUST_GUARD_ADVANTAGE); the stance's own blow is brought forward
   *  to land COUNTER_DELAY from now (its clock moved on to its contact, so the page draws the strike out of the stance),
   *  and is worth COUNTER_DAMAGE of itself (hit). */
  private counterStance(target: Actor, thrower: Actor, fromX: number, fromZ: number, slot: AttackSlot, contactIndex?: number) {
    const cast = target.cast!, p = target.state, now = this.serverTime;
    cast.countered = true;
    thrower.cast = null; thrower.rushUntil = -Infinity; thrower.dashUntil = Math.min(thrower.dashUntil, now);
    const stagger = JUST_GUARD_ADVANTAGE;
    thrower.stunUntil = Math.max(thrower.stunUntil, now + stagger); thrower.parriedUntil = now + stagger;
    thrower.reaction = 'hurt'; thrower.reactionClip = stagger; thrower.staggeredAt = now;
    const n = Math.hypot(fromX, fromZ) || 1;
    thrower.kx = fromX / n * 2; thrower.kz = fromZ / n * 2; thrower.knockbackDrag = 10;
    this.action(thrower, 'hurt', stagger, true);
    // The stance's clock goes on to its blow: the strike lands COUNTER_DELAY from now.
    const shift = Math.max(0, cast.move.contacts[0] - COUNTER_DELAY - (now - cast.start));
    cast.start -= shift; p.actionStarted -= shift;
    this.freeze(thrower, PARRY_FREEZE); this.freeze(target, PARRY_FREEZE * .5);
    p.stamina = Math.min(p.maxStamina ?? 100, p.stamina + PARRY_STAMINA);
    this.emit({ kind: 'counter', actorId: p.id, targetId: thrower.state.id, fighter: p.fighter, slot: 'heavy', branch: 'counter', contactIndex,
      origin: centre(p), endpoint: centre(thrower.state), reason: slot });
  }
  /** Techniques: how well a bot knows the combo landing on it now - the share of ROUTE_KNOWN of the last few combos on it
   *  that opened the same way (0: never seen it, 1: knows it). */
  private familiarity(a: Actor) {
    const now = a.routeNow.split('.');
    if (now.length < 2 || !a.seenRoutes.length) return 0;
    const head = now.slice(0, ROUTE_HEAD).join('.');
    let seen = 0;
    for (const route of a.seenRoutes) if (route.startsWith(head)) seen++;
    return Math.min(1, seen / ROUTE_KNOWN);
  }

  /** Lock combat: a bot caught at a round's end tries the escape now and then (LOCK_BOT_ESCAPE, by skill), pressed
   *  when a person would - a reaction after the freeze, with a person's spread - so a hurried press is early and a
   *  slow one late. With the bar short of the escape it does not try. */
  private botLockEscape(a: Actor) {
    const skill = a.botSkill;
    if (a.lockBarred || a.state.stamina < LOCK_VANISH_STAMINA) return;
    // Techniques: a string it has seen again and again it is ready for (familiarity).
    if (this.random() >= LOCK_BOT_ESCAPE[0] + (LOCK_BOT_ESCAPE[1] - LOCK_BOT_ESCAPE[0]) * skill + READ_ESCAPE * this.familiarity(a)) return;
    const react = LOCK_BOT_REACT[0] + (LOCK_BOT_REACT[1] - LOCK_BOT_REACT[0]) * skill;
    const spread = LOCK_BOT_SPREAD[0] + (LOCK_BOT_SPREAD[1] - LOCK_BOT_SPREAD[0]) * skill;
    const press = Math.max(this.serverTime, a.hitstopUntil) + Math.max(.02, react + this.gauss() * spread);
    a.botGuardFrom = press; a.botGuardUntil = press + .12; a.botTimed = true;
  }

  private tally(target: Actor, attacker: Actor | undefined, applied: number) {
    if (applied <= 0) return;
    target.state.damageTaken = (target.state.damageTaken ?? 0) + applied;
    if (attacker && attacker !== target) attacker.state.damageDealt = (attacker.state.damageDealt ?? 0) + applied;
    this.adaptive.tally(attacker?.state.id, target.state.id, applied);
  }

  /** Adaptive difficulty (adaptive.ts): every RETUNE_SECONDS the bots are set against the humans they face, and each
   *  human's skill so far is written on their state, where their page reads it (PlayerState.skill). */
  private retuneBots() {
    if (!this.adaptive.due(this.serverTime)) return;
    const humans: string[] = [], bots: string[] = [];
    for (const a of this.actors.values()) (a.state.isBot && !this.adaptive.standIns.has(a.state.id) ? bots : humans).push(a.state.id);
    const before = this.adaptive.looked;
    this.adaptive.look(this.serverTime, { humans: () => humans, bots: () => bots, hostile: (a, b) => {
      const x = this.actors.get(a)?.state, y = this.actors.get(b)?.state;
      return !!x && !!y && this.hostile(x, y);
    } });
    if (this.adaptive.looked === before) return;
    for (const id of humans) {
      const skill = this.adaptive.skillOf(id), state = this.actors.get(id)?.state;
      if (state && skill !== undefined) state.skill = Math.round(skill * 1000) / 1000;
    }
  }

  private eliminate(a: Actor, actorId: string) {
    a.state.alive = false; a.state.hp = 0; a.state.guarding = false; a.cast = null;
    a.state.awakened = false; a.state.awakenedUntil = 0; a.awakenEntryUntil = 0;
    // The kill goes to whoever landed the last blow. The water is nobody's:
    // `actorId` is 'water' there and matches no one.
    const killer = this.actors.get(actorId);
    if (killer && killer !== a) killer.state.kills = (killer.state.kills ?? 0) + 1;
    // The royale (KO_HEAL): whoever scored it, still standing, gets a share of their bar back - never past full.
    const heal = killer && killer !== a && killer.state.alive && this.koHeal > 0
      ? Math.min(killer.state.maxHp - killer.state.hp, killer.state.maxHp * this.koHeal) : 0;
    if (killer && heal > 0) killer.state.hp += heal;
    a.respawnAt = this.serverTime + DEFEAT_TIME;
    this.action(a, 'defeated', DEFEAT_TIME);
    this.emit({ kind: 'eliminated', actorId, targetId: a.state.id, ...(heal > 0 ? { heal } : {}) });
  }

  private respawn(a: Actor) {
    delete a.statuses; delete a.state.status;
    // Statistics survive a training respawn: they are the session's, and the
    // practice 'reset' command is what clears them.
    Object.assign(a.state, a.spawn, { hp: a.state.maxHp, stamina: a.state.maxStamina??100, ultimate: 0, awakening: 0, alive: true, grounded: true, guarding: false,
      cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0 } });
    a.vy = a.kx = a.kz = a.stunUntil = a.dashUntil = 0;
    a.jumping = false; a.dashSeconds = DASH_SECONDS; a.dashKind = 'forward';
    a.groundedAt = a.landedUntil = -Infinity; a.leapt = false; // Round 4b (JUMP)
    a.knockbackDrag = 7;a.freezeUntil=0;a.state.timeStopped=false;
    a.reaction = null; a.hitstopFrom = a.hitstopUntil = a.comboUntil = 0;
    a.state.combo = 0; a.state.hitstop = false;
    a.launchSlot = undefined;
    // Both defeat respawn and the practice reset grant 1.25 seconds of protection.
    a.evadeUntil = this.serverTime + 1.25;
    a.input.moveX = a.input.moveZ = 0;
    a.cast = null; a.chainHits = a.scalingHits = 0; a.dashY = 0; a.dashEntry = 0; a.dashPlateau = 1; a.juggleHits = 0;
    a.jumpAt = a.dashAt = a.attackAt = a.awakenAt = a.guardAt = -Infinity;
    a.attackHold = a.attackNotified = -Infinity; a.pressQueue = undefined; a.reactionClip = .3; Object.assign(a, pressClock());
    a.wasGuarding = false; a.guardHeld = false; a.guardPressedAt = -Infinity;
    a.guardReleasedAt = a.parryLockUntil = a.counterUntil = a.parriedUntil = -Infinity; a.parryCaught = false;
    a.bounceOnLand = false; a.mx = a.mz = 0; a.blockedUntil = -Infinity;
    a.rushUntil = a.chaseUntil = a.lightChaseUntil = a.vanishedAt = -Infinity; a.rushOpened = []; a.chaseTargetId = a.vanishOn = undefined; a.dashChase = false;
    a.awakenEntryUntil = 0; a.state.awakened = false; a.state.awakenedUntil = 0;
    this.action(a, 'idle');
    // Couch Training's pair (seatPair): back on its seat, turned to the other.
    if (this.pair?.includes(a.state.id)) this.faceOff(a);
    this.emit({ kind: 'respawn', actorId: a.state.id, origin: position(a.state) });
  }

  trainingCommand(requesterId:string, command:unknown):boolean {
    if(this.roomMode!=='training'||!this.actors.has(requesterId))return false;
    if(command==='passive'||command==='combat'){
      this.trainingBotMode=command;this.trainingLab.behaviour=command;this.trainingLab.stop();
      for(const actor of this.actors.values())if(actor.state.isBot){actor.input={seq:actor.lastSeq+1,moveX:0,moveZ:0,yaw:actor.state.yaw};actor.cast=null;}
      return true;
    }
    if(command==='reset'){
      for(const actor of this.actors.values()){this.respawn(actor);Object.assign(actor.state,{kills:0,damageDealt:0,damageTaken:0});}
      this.projectiles=[];this.areas=[];this.trainingLab.resetPositions(this);
      // Couch Training's pair: both on their seats, each turned to where the other now stands, with no spawn protection.
      for(const id of this.pair??[]){const actor=this.actors.get(id);if(actor){this.faceOff(actor);actor.evadeUntil=0;}}
      return true;
    }
    // Both bars, so the practice room can try the transformation and the
    // ultimate in the same breath without an exchange to earn either. Couch Training fills both people's.
    if(command==='awakening'){for(const id of this.pair?.includes(requesterId)?this.pair:[requesterId])Object.assign(this.actors.get(id)!.state,{ultimate:100,awakening:100});return true;}
    return this.trainingLab.command(this,requesterId,command);
  }

  swapFighter(id: string, fighter: FighterId): boolean {
    const swapped = this.actors.get(id);
    if (this.roomMode !== 'training' || !swapped || swapped.external || !(fighter in MOVES)) return false;
    for (const actor of this.actors.values()) {
      // (respawn puts a body on its spawn: for this one call that is where it stands, so nothing moves and its event says so.)
      const p = actor.state, spawn = actor.spawn, grounded = p.grounded;
      actor.spawn = position(p); this.respawn(actor); actor.spawn = spawn;
      Object.assign(p, { grounded, kills: 0, damageDealt: 0, damageTaken: 0 });
      // As after the practice reset: no hidden invulnerability.
      actor.evadeUntil = 0;
    }
    this.projectiles = []; this.areas = [];
    const p = swapped.state;
    p.fighter = fighter;
    if (BODY_SIZE[fighter]) p.size = BODY_SIZE[fighter]; else delete p.size;
    delete swapped.forged; delete p.forge; delete p.outfit;
    for (const actor of this.actors.values()) this.faceOff(actor);
    return true;
  }

  private thinkBot(a: Actor) {
    if(this.roomMode==='training'){const input=this.trainingLab.dummy(this,a.state.id);if(input){this.submitInput(a.state.id,{...input,seq:a.lastSeq+1});return;}}
    if(this.roomMode==='training'&&this.trainingBotMode==='passive'){a.input.moveX=a.input.moveZ=0;a.input.attack=undefined;a.input.guard=false;return;}
    // A reflex, on every tick rather than on the thinking clock: a parry
    // lives in a sixth of a second, which the thinking clock steps over.
    this.botDefend(a);
    if (this.serverTime < a.nextBotThink) return;
    // Not every bot thinks at the same rate. A field of twelve on one clock
    // reads as one opponent copied twelve times.
    a.nextBotThink = this.serverTime + .18 + a.botSkill * .16;
    // In a royale a bot fights whoever is nearest, bot or not. In training the
    // sparring bot only ever has the one person to look at.
    const opponents = [...this.actors.values()].filter(b => b !== a && b.state.alive && this.hostile(a.state, b.state)
      && (this.roomMode === 'match' || !b.state.isBot));
    opponents.sort((x, y) => distance(a.state, x.state) - distance(a.state, y.state));
    if (!opponents.length) { a.input.moveX = a.input.moveZ = 0; return; }
    // Round 3e (VARIETY): on a stage with walls and ledges in it, the nearest
    // one it can get to, and the way there (botTarget, botHeading).
    const nav = this.collision ? NavGrid.for(this.stage) : undefined;
    const mind = nav ? this.mindOf(a) : undefined;
    const other = nav && mind ? this.botTarget(a, mind, opponents, nav) : opponents[0];
    // Adaptive difficulty: a bot that goes after a human stands ahead of that human (adaptive.ts).
    if (!other.state.isBot) this.adaptive.engage(a.state.id, other.state.id);
    const dx = other.state.x - a.state.x, dz = other.state.z - a.state.z, d = Math.hypot(dx, dz) || 1;
    const head = nav && mind ? this.botHeading(a, mind, other, nav) : undefined;
    // Ground hits (8 October 2026): the body it is after, down on the floor or
    // getting up off it (botFloor). Down, a normal lands for half and an
    // ultimate whole; getting up, every normal is dodged and an ultimate is
    // not. A body the old rule still holds for (a kit body: arcade survival,
    // Last Stand) is gone after as it always was.
    const floor = this.fighterBlow(a, other) ? this.botFloor(other) : undefined;

    // Round 4 (STAGES): there is no ring to run from any more; the royale is
    // closed by the hunt instead (botHunt).
    const fromCentre = Math.hypot(a.state.x, a.state.z);

    // Aggression is the bot's own, not the roster's: a mixed field where one
    // of them presses and another waits is a fight rather than a drill.
    const aggression = .6 + a.botSkill * .55;
    const p = a.state;
    const swing = this.botSwing(a);
    const ready = (slot: AttackSlot) => this.serverTime > (p.cooldowns[slot] ?? 0);
    let attack: AttackSlot | undefined, areaPick: { x: number; z: number; caught: number } | undefined;
    // Techniques (techniques.ts): the stick a bot's press is made with - neutral unless it means a technique.
    let dir: StickDir = 'n', tech: { attack: AttackSlot; dir: StickDir } | undefined;
    // Round 5 (PARRY): winded. The bar a bot swings and dashes with is its
    // guard too, and a bot that spent it all - which, swinging on nearly every
    // thought, it always had - held its guard up on an empty bar and was
    // broken by the first jab. Spent, it stops starting exchanges until it has
    // some back; the better the bot, the more it keeps in hand.
    const low = BOT_WINDED[0] + BOT_WINDED[2] * a.botSkill;
    a.botWinded = p.stamina < low || !!a.botWinded && p.stamina < low + BOT_WINDED[1];
    // A string of its own that has landed is carried on - the next light is
    // the next stage - and a skilled bot sometimes finishes it on something
    // heavier than the rush finisher: a heavy, or its special when it is up.
    const landed = a.cast?.slot === 'light' && a.cast.connected ? a.cast : undefined;
    // Its own launch just sent somebody flying: go after them, and have the
    // air follow-up already pressed for when the chase arrives.
    // A string of its own still running comes first: a landed stage is carried
    // on (in the air as well - the juggle the air stages ride re-opens the
    // chase window on every hit), and the finisher's own follow-up light is
    // the chase by itself.
    const chase = !landed && this.serverTime <= a.chaseUntil && (p.stamina >= 20 || STAMINA_OVERDRAW) && this.random() < .3 + a.botSkill * .5;
    // The ultimate comes out on a full ultimate bar, and the transformation
    // on a full awakening bar: two meters, two decisions, the same as a human.
    // A skilled bot that sees a swing coming at it waits for it instead of
    // swinging into it - a fighter mid-swing cannot guard - and lets the
    // reflex in botParry take it on the beat.
    // Round 5 (PARRY): turtling. Close to somebody and free, now and then a
    // bot puts its guard up instead of swinging, and keeps it there a while
    // (botDefend carries it): what blocks the jabs too fast to read. Before
    // this a bot swung on nearly every thought and was mid-swing for nine in
    // ten of the blows that reached it - it could not guard any of them.
    // Mid-swing, the guard goes up when the swing is over. Not with a blow
    // already on its way in: the press would be a parry nobody timed (the
    // reflex answers that one).
    const soon = this.incomingMelee(a);
    // (Ground hits: not over a body on the floor, which throws nothing.)
    if (!chase && !landed && !floor && d < 3.4 && a.botGuardUntil === undefined && this.serverTime >= a.counterUntil
        && (soon === undefined || soon > BOT_GUARD_LEAD + .02) && p.stamina >= BOT_GUARD_STAMINA
        && this.random() < BOT_TURTLE[0] + (BOT_TURTLE[1] - BOT_TURTLE[0]) * a.botSkill) {
      const free = a.cast ? Math.max(this.serverTime, a.cast.start + a.cast.move.duration) : this.serverTime;
      a.botGuardFrom = free; a.botGuardUntil = free + .35 + this.random() * .45; a.botTimed = false;
    }
    // Round 5 (PARRY): it waits while its guard is planned - a blow its reflex
    // (botDefend) means to take on it, or a turtle - and only then: a bot that
    // waited and then did nothing stood still and ate the swing.
    const wait = !chase && !landed && a.botGuardUntil !== undefined && this.serverTime < a.botGuardUntil;
    if (wait) a.attackHold = a.attackAt = -Infinity;
    // Round 5 (PARRY): its own parry left the thrower reeling - the punish,
    // a heavy when it is up, else the string.
    const punish = !wait && this.serverTime < a.counterUntil;
    // Round 3e (VARIETY): a string whose finisher leaves them reeling
    // (RUSH_SHAPE stagger or spin), or a heavy that does, is carried on from
    // it - the heavy out of the string, the string out of the heavy.
    const reeling = this.botFollowUp(a, other);
    // Round 3e: out of its reach (a wall or a ledge between them): only what
    // flies, and only along a clear line.
    const apart = !!head && !head.reachable;
    const sighted = !apart || this.botSight(a, other);
    // Ground hits: its ultimate, when it has it up, at a body on the floor or
    // getting up off it - nothing is surer to confirm - from inside the
    // opener's reach (botUltimateReach).
    if (floor && !wait && p.ultimate >= ULTIMATE_COST && ready('ultimate') && d < this.botUltimateReach(a)
        && this.random() < .55 + a.botSkill * .4) attack = 'ultimate';
    else if (chase) attack = 'light';
    else if (wait) attack = undefined;
    else if (punish) attack = ready('heavy') && this.random() < .45 + a.botSkill * .4 ? 'heavy' : 'light';
    else if (reeling) attack = reeling;
    // Ground hits: getting up, every normal would be dodged - it closes in and
    // waits; down, only a light is worth throwing - a ground hit, for less -
    // now and then, and no heavy, special or ender is spent on a body a ground
    // hit never throws anywhere. Ground hits 2: nor a light once the stay's
    // budget is spent (floorSpent), which would land for nothing.
    else if (floor === 'rising') attack = undefined;
    else if (floor === 'down') attack = d < swing && !a.botWinded && !this.floorSpent(other) && this.random() < .4 + a.botSkill * .3 ? 'light' : undefined;
    else if ((areaPick = this.botArea(a, opponents)) && (areaPick.caught >= 2 || d > 4.5)
      && this.random() < (areaPick.caught >= 2 ? .55 : .2 + a.botSkill * .15) * aggression) attack = 'area';
    else if (apart) attack = sighted && d < 20 && ready('special') && this.random() < .3 * aggression ? 'special'
      : sighted && this.moveOf(a, 'heavy').style !== 'melee' && d < this.moveOf(a, 'heavy').range && this.random() < .25 ? 'heavy' : undefined;
    else if (p.ultimate >= ULTIMATE_COST && d < 6 && ready('ultimate') && this.random() < .35 * aggression) attack = 'ultimate';
    // (Lock combat, one on one: the string is the rounds and their finisher, carried on light by light as a person
    // mashing carries it - an ender out of it cut the second round short and threw its heavy at a body the knockaway had
    // sent off: bot Duels ran 29% longer than on the live rules, their heavies landing 49% of the time against 78%. With
    // somebody else within LOCK_BOT_CROWD the ender stands: a royale's long strings were cut into by third parties.)
    else if (landed && this.locking(a) && (opponents.length < 2 || distance(p, opponents[1].state) > LOCK_BOT_CROWD)) attack = 'light';
    else if (landed) attack = hasCombos(p.fighter) ? this.botEnder(a, landed) ?? 'light'
      : landed.stage >= 1 && this.random() < .1 + a.botSkill * .3
      ? ready('special') && this.random() < .4 ? 'special' : 'heavy' : 'light';
    // Techniques: a heavy of its own that landed is carried into the heavy string now and then, the better bot the more.
    else if (a.cast?.slot === 'heavy' && a.cast.connected && (!a.cast.branch || a.cast.branch === 'hh') && this.random() < .2 + a.botSkill * .3) attack = 'heavy';
    // Techniques: the stick's own moves, where the moment asks for one (botTechnique).
    else if ((tech = this.botTechnique(a, other, d, swing))) { attack = tech.attack; dir = tech.dir; }
    // Round 3e (VARIETY): in its own reach, and the stride its step closes -
    // a claw or a fist that swung from 2.9 m, as a sword does, only ever hit
    // the air, and the short-armed fighters lost nearly every bot duel.
    else if (d < swing && !a.botWinded) attack = this.random() < .24 ? 'heavy' : 'light';
    else if (d < 23 && sighted && ready('special') && !a.botWinded && this.random() < .12 * aggression) attack = 'special';
    const awaken = !p.awakened && (p.awakening ?? 0) >= AWAKENING_COST && this.random() < .25 * aggression;
    // Throwing something is a change of mind: whatever guard was planned is dropped.
    if (attack) { a.botGuardFrom = a.botGuardUntil = undefined; a.botTimed = false; }
    const guard = this.botGuarding(a);
    // Close the gap, then circle rather than stand in it. Round 3e: along the
    // route where there is one, and at a run while the gap is wide - a bot
    // walked across the harbour at half speed.
    const strafe = d < 4.5 && !apart ? Math.sin(this.serverTime * .7 + a.botSkill * 6) * .35 : 0;
    const pace = d > 6 ? 1 : .5 + a.botSkill * .3;
    let hx = head ? head.x : dx / d, hz = head ? head.z : dz / d, closing = d > Math.min(2.6, swing - .3);
    if (apart && nav && mind) {
      // Out of reach: it holds where it can see them and throws what flies;
      // where it cannot, it makes for the middle, where the fight will be.
      // With no way there either, it tries the straight line and jumps when
      // it snags: the grid is not the whole truth (it cannot see a kerb it
      // could have hopped).
      const hold = sighted && d < 20;
      const middle = !hold && fromCentre > 6 ? this.botRoute(a, mind, 'ring', 0, 0, nav) : undefined;
      closing = !hold && (!!middle || fromCentre > 6 || d > 4);
      if (middle) { hx = middle.x; hz = middle.z; }
    }
    const stuck = mind && closing ? this.botStuck(a, mind) : false;
    let hop = false;
    this.submitInput(a.state.id, { seq: a.lastSeq + 1,
      moveX: (closing ? hx * pace : 0) + dz / d * strafe,
      moveZ: (closing ? hz * pace : 0) - dx / d * strafe,
      yaw: Math.atan2(dx, dz), targetId: other.state.id, attack, guard: guard && !attack, awaken, ...(attack ? { dir } : {}),
      ...(attack === 'area' && areaPick ? { aim: { x: areaPick.x, z: areaPick.z } } : {}),
      // Inside the light-chase window the light alone is the chase, the way a
      // player mashing it gets one; after it, the dash still is.
      // Round 3e (VARIETY): and a short arm dashes in through a long one's
      // reach, while it is not swinging, rather than walking onto it.
      dash: chase ? this.serverTime > a.lightChaseUntil : (!head || head.straight) && (d > 9 && this.random() < .18 * aggression
        || d > swing && d < swing + 3 && swing < 2.6 && !other.cast && this.random() < .3 * aggression),
      jump: !chase && (stuck || (hop = d < 6 && this.random() < .05)) });
    // Round 4b (JUMP): a hop at somebody close is a hop on the spot, not the
    // leap a jump along a run is now (8-9 m at 15-19 m/s), which carried it
    // over their head; a stuck bot's jump still goes where it was going.
    if (hop) a.input.moveX = a.input.moveZ = 0;
  }

  /** Techniques (techniques.ts): the stick move a bot throws now, if the moment asks for one - a Rising Strike at a body
   *  in the air close by; against a swing coming at it, the counter stance or the sidestep; a charge at a guard held up;
   *  a rush in from a stride or two out. Each as often as its skill says, and only when the technique is ready. */
  private botTechnique(a: Actor, other: Actor, d: number, swing: number): { attack: AttackSlot; dir: StickDir } | undefined {
    if (a.kit || other.kit || a.botWinded || !a.state.grounded) return undefined;
    const skill = a.botSkill, roll = this.random(), q = other.state;
    const ready = (key: TechniqueKey) => (a.techniqueReady[key] ?? -Infinity) <= this.serverTime;
    // Getting up with somebody standing over it: the Wake-up Strike, pressed as it rises.
    if (a.reaction === 'getup' && d < 2.6 && ready('wakeUp') && this.serverTime >= a.stunUntil - .15 && roll < .15 + skill * .3) return { attack: 'light', dir: 'n' };
    if (!q.grounded && d < 3 && ready('rise') && roll < .15 + skill * .3) return { attack: 'light', dir: 'b' };
    if (other.cast && !other.cast.connected && other.cast.move.style === 'melee' && d < 3.2) {
      // A string it has seen again and again it answers more (familiarity): the counter stance waits for it.
      const known = this.familiarity(a);
      if (ready('counter') && roll < .03 + skill * .12 + READ_COUNTER * known) return { attack: 'heavy', dir: 'b' };
      if (ready('slip') && roll < .08 + skill * .16 + READ_SLIP * known) return { attack: 'light', dir: 's' };
    }
    if (q.guarding && d < swing + 1.5 && ready('charge') && roll < .2 + skill * .25) return { attack: 'heavy', dir: 'f' };
    if (d > swing && d < 5.5 && ready('rush') && roll < .1 + skill * .18) return { attack: 'light', dir: 'f' };
    return undefined;
  }

  private botArea(a: Actor, opponents: Actor[]): { x: number; z: number; caught: number } | undefined {
    const p = a.state;
    if (a.kit || a.botWinded || this.serverTime <= (p.cooldowns.area ?? 0)) return undefined;
    const m = this.moveOf(a, 'area');
    if (!m.area || p.stamina < m.stamina) return undefined;
    const lead = (m.contacts[0] ?? 0) + m.area.telegraph, { halfX, halfZ } = this.bounds;
    const ahead: { x: number; z: number }[] = [];
    for (const o of opponents) {
      if (Math.hypot(o.state.x - p.x, o.state.z - p.z) > m.range + m.radius) continue;
      ahead.push({ x: clamp(o.state.x + (o.mx + o.kx) * lead, -halfX, halfX), z: clamp(o.state.z + (o.mz + o.kz) * lead, -halfZ, halfZ) });
    }
    if (!ahead.length) return undefined;
    const spots = [...ahead];
    for (let i = 0; i < ahead.length; i++) for (let j = i + 1; j < ahead.length; j++) spots.push({ x: (ahead[i].x + ahead[j].x) / 2, z: (ahead[i].z + ahead[j].z) / 2 });
    let best: { x: number; z: number; caught: number } | undefined;
    for (const spot of spots) {
      if (Math.hypot(spot.x - p.x, spot.z - p.z) > m.range) continue;
      let caught = 0;
      for (const each of ahead) if (Math.hypot(each.x - spot.x, each.z - spot.z) <= m.radius * .85) caught++;
      if (!best || caught > best.caught) best = { x: +spot.x.toFixed(2), z: +spot.z.toFixed(2), caught };
    }
    return best;
  }

  /** Round 3e (VARIETY): how far off a bot swings its light: its reach and
   *  the stride its step-in closes before the blow (MAX_APPROACH over half
   *  the wind-up), never further than the 2.9 m every bot used. */
  private botSwing(a: Actor): number {
    const light = this.moveOf(a, 'light');
    return Math.min(2.9, this.reachOf(a, 'light', light) + Math.min(1.2, MAX_APPROACH * light.contacts[0] * .5));
  }

  /** Ground hits: what the floor makes of a body a bot is after - 'down' on
   *  it (a ground hit's), 'rising' off it (every normal dodged, an ultimate
   *  not) - or undefined. */
  private botFloor(o: Actor): 'down' | 'rising' | undefined {
    return this.down(o) ? 'down' : o.reaction === 'getup' ? 'rising' : undefined;
  }

  /** Ground hits 2: whether a body's stay on the floor has nothing left to give a ground hit (GROUND_HIT_BUDGET). */
  private floorSpent(o: Actor) { return groundHitDamage(1, o.floorHits, o.floorTaken, o.state.maxHp) === 0; }

  /** Ground hits: how far off a bot throws its ultimate at a body on the
   *  floor: inside a time stop's radius, or the reach its opener closes, and
   *  never further than the 6 m it throws one at anybody from. */
  private botUltimateReach(a: Actor): number {
    const move = this.moveOf(a, 'ultimate');
    if (move.timeStop) return move.timeStop.radius - .3;
    return Math.min(6, this.intentReach(a, 'ultimate', move));
  }

  /** Round 3e (VARIETY): a bot's memory (BotMind), made on first use. */
  private mindOf(a: Actor): BotMind {
    let mind = this.minds.get(a.state.id);
    if (!mind) {
      mind = { routes: new Map(), best: Infinity, bestAt: this.serverTime,
        stillX: a.state.x, stillZ: a.state.z, stillSince: this.serverTime, given: new Map() };
      this.minds.set(a.state.id, mind);
    }
    return mind;
  }

  /** Round 3e (VARIETY): whom a bot goes after - the nearest opponent it can
   *  get to. It keeps the one it has while that one is not much further than
   *  the nearest; a body with no route to it (a wall, a ledge, the canal),
   *  or one it has chased for BOT_GIVE_UP_AFTER without getting closer, is
   *  left alone for BOT_GIVE_UP_FOR. With everybody out of reach it faces the
   *  nearest, for whatever it can throw at them. `opponents` is nearest first. */
  private botTarget(a: Actor, mind: BotMind, opponents: Actor[], nav: NavGrid): Actor {
    const now = this.serverTime, p = a.state;
    const open = (o: Actor) => (mind.given.get(o.state.id) ?? -Infinity) <= now;
    const nearest = distance(p, opponents[0].state);
    let chosen = mind.targetId ? opponents.find(o => o.state.id === mind.targetId && open(o)) : undefined;
    if (chosen && distance(p, chosen.state) > nearest * 1.4 + 2) chosen = undefined;
    chosen = this.botHunt(a, mind, opponents, nav) ?? chosen; // Round 4 (STAGES): a fighter nobody is fighting is hunted.
    if (chosen) {
      // Not getting any closer: give them up.
      const d = distance(p, chosen.state);
      if (d < 4 || d < mind.best - .5) { mind.best = d; mind.bestAt = now; }
      else if (now - mind.bestAt > BOT_GIVE_UP_AFTER) { mind.given.set(chosen.state.id, now + BOT_GIVE_UP_FOR); chosen = undefined; }
    }
    if (!chosen) {
      // Round 4 (STAGES): the nearest, counting each bot already after a body
      // as BOT_SPREAD metres further off (botCrowd) - so the field spreads
      // over its opponents, a player nobody has taken on is taken on, and
      // nobody gets a pack. Nobody further can score better than the best.
      let best = Infinity;
      for (let k = 0; k < opponents.length && k < 4; k++) {
        const o = opponents[k], d = distance(p, o.state);
        if (d >= best) break;
        if (!open(o)) continue;
        if (!this.botReachable(a, mind, o, nav)) { mind.given.set(o.state.id, now + BOT_GIVE_UP_FOR); continue; }
        const score = d + this.botCrowd(a, o, d);
        if (score < best) { best = score; chosen = o; }
      }
    }
    chosen ??= opponents[0];
    if (chosen.state.id !== mind.targetId) { mind.targetId = chosen.state.id; mind.best = distance(p, chosen.state); mind.bestAt = now; }
    return chosen;
  }

  /** Round 4 (STAGES), from round 3f (RULES): the quiet fighter this bot is
   *  hunting, if it is the one to go (HUNT_QUIET). A royale fighter nobody
   *  has landed a blow on or taken one from for HUNT_QUIET seconds - a
   *  passive player standing off, or one walking away from every fight - is
   *  gone after by the nearest bot that is not in a fight of its own
   *  (botBusy) and has a way to them: one bot, never a pack, and nobody is
   *  pulled out of an exchange for it - until they have waited HUNT_ANYWAY,
   *  when the nearest bot goes whatever it is doing. The hunt is over once a
   *  blow lands on them or by them (whoever's), or the hunter is drawn into a
   *  fight of its own (not after HUNT_ANYWAY), gives them up (not getting
   *  closer: botTarget) or goes down - and the next bot may go. Undefined
   *  when this bot is not hunting. */
  private botHunt(a: Actor, mind: BotMind, opponents: Actor[], nav: NavGrid): Actor | undefined {
    if (this.roomMode !== 'match') return undefined;
    const now = this.serverTime, p = a.state;
    for (const [id, hunt] of this.hunts) {
      const quarry = this.actors.get(id), hunter = this.actors.get(hunt.by);
      if (!quarry?.state.alive || !hunter?.state.alive || this.engagedAt(quarry) >= hunt.since
        || !hunt.anyway && this.botBusy(hunter, id) || (this.minds.get(hunt.by)?.given.get(id) ?? -Infinity) > now) this.hunts.delete(id);
      else if (hunt.by === p.id) return quarry;
    }
    const busy = this.botBusy(a);
    for (const o of opponents) {
      const id = o.state.id, quiet = now - this.engagedAt(o);
      if (this.hunts.has(id) || (mind.given.get(id) ?? -Infinity) > now || quiet < HUNT_QUIET) continue;
      // A bot in a fight is sent only once the quarry has waited HUNT_ANYWAY.
      const anyway = quiet >= HUNT_ANYWAY;
      if (busy && !anyway || this.freeHunter(o, anyway) !== a || !this.botReachable(a, mind, o, nav)) continue;
      this.hunts.set(id, { by: p.id, since: now, anyway });
      mind.targetId = id; mind.best = distance(p, o.state); mind.bestAt = now;
      return o;
    }
    return undefined;
  }

  /** Round 4 (STAGES): how much further off `o` counts for bot `a` choosing
   *  whom to fight: BOT_SPREAD for every other living bot already after them,
   *  and nothing within BOT_TAKE_ON. A bot used to take the nearest body
   *  whoever else was on it: a royale paired off into duels round the spawn
   *  circle and a player between two pairs was nobody's, while one in the
   *  middle of them drew them all. */
  private botCrowd(a: Actor, o: Actor, d: number): number {
    if (d <= BOT_TAKE_ON) return 0;
    let on = 0;
    for (const b of this.actors.values()) {
      if (b === a || b === o || !b.state.isBot || !b.state.alive) continue;
      if (this.minds.get(b.state.id)?.targetId === o.state.id) on++;
    }
    return on * BOT_SPREAD;
  }

  /** Round 4 (STAGES): when `o` last landed or took a blow (hit or guarded)
   *  - the match's start at the earliest. What it has dealt is read off its
   *  tally as the bots see it, a think apart at most. */
  private engagedAt(o: Actor): number {
    const p = o.state, total = p.damageDealt ?? 0;
    let mark = this.dealt.get(p.id);
    if (!mark) this.dealt.set(p.id, mark = { total, at: -Infinity });
    else if (mark.total !== total) { mark.total = total; mark.at = this.serverTime; }
    return Math.max(this.startedAt, o.lastDamageAt, o.blockedUntil, mark.at);
  }

  /** Round 4 (STAGES): whether a bot is in a fight of its own: it has landed
   *  or taken a blow within BOT_BUSY, or the body it is after (other than
   *  `quarry`, the one it hunts) is within BOT_BUSY_NEAR. */
  private botBusy(b: Actor, quarry?: string): boolean {
    if (this.serverTime - this.engagedAt(b) < BOT_BUSY) return true;
    const target = this.minds.get(b.state.id)?.targetId;
    const q = target && target !== quarry ? this.actors.get(target)?.state : undefined;
    return !!q?.alive && distance(b.state, q) < BOT_BUSY_NEAR;
  }

  /** Round 4 (STAGES): the bot that would go after `o`: the nearest living
   *  bot, hostile to them, not hunting already, and not in a fight - unless
   *  `anyway` (HUNT_ANYWAY). */
  private freeHunter(o: Actor, anyway = false): Actor | undefined {
    let best: Actor | undefined, gap = Infinity;
    for (const b of this.actors.values()) {
      if (b === o || !b.state.isBot || b.external || !b.state.alive || !this.hostile(b.state, o.state)) continue;
      let hunting = false;
      for (const hunt of this.hunts.values()) if (hunt.by === b.state.id) { hunting = true; break; }
      if (hunting || !anyway && this.botBusy(b)) continue;
      const d = distance(b.state, o.state);
      if (d < gap) { gap = d; best = b; }
    }
    return best;
  }

  /** Round 3e (VARIETY): whether there is a way along the floor from a bot
   *  to a body - a clear straight line, or a route (planned and kept). */
  private botReachable(a: Actor, mind: BotMind, o: Actor, nav: NavGrid): boolean {
    const p = a.state, q = o.state;
    if (Math.abs(q.y - p.y) < 1.3 && nav.clear(p.x, p.z, q.x, q.z)) return true;
    return !!this.botRoute(a, mind, q.id, q.x, q.z, nav, true);
  }

  /** Round 3e (VARIETY): which way a bot heads for a body: straight at it
   *  where the floor between them is clear and they are level, else along
   *  its route. Unreachable when there is none. */
  private botHeading(a: Actor, mind: BotMind, o: Actor, nav: NavGrid): { x: number; z: number; reachable: boolean; straight: boolean } {
    const p = a.state, q = o.state, dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz) || 1;
    if (Math.abs(q.y - p.y) < 1.3 && nav.clear(p.x, p.z, q.x, q.z)) return { x: dx / d, z: dz / d, reachable: true, straight: true };
    const way = this.botRoute(a, mind, q.id, q.x, q.z, nav);
    // A body up on something it cannot stand on (a ledge, a crate) is out of
    // reach even when the cell under it is not.
    if (!way || !nav.walkable(q.x, q.z) && Math.hypot(dx, dz) < 3.5) return { x: dx / d, z: dz / d, reachable: false, straight: false };
    return { x: way.x, z: way.z, reachable: true, straight: false };
  }

  /** Round 3e (VARIETY): the unit direction along a bot's route to (x, z) -
   *  planned afresh when it is BOT_REPLAN old, leads somewhere else, or the
   *  body it leads to has moved off its end - or undefined when there is no
   *  route. `probe` only asks whether there is one. */
  private botRoute(a: Actor, mind: BotMind, key: string, x: number, z: number, nav: NavGrid, probe = false): { x: number; z: number } | undefined {
    const p = a.state, now = this.serverTime;
    let plan = mind.routes.get(key);
    if (!plan || now - plan.at > BOT_REPLAN || Math.hypot(x - plan.x, z - plan.z) > 2.5) {
      // Old plans to bodies it no longer thinks about are dropped.
      if (!plan && mind.routes.size > 6) for (const [k, v] of mind.routes) if (now - v.at > BOT_REPLAN * 3) mind.routes.delete(k);
      plan = { cells: nav.path(p.x, p.z, x, z), x, z, at: now };
      mind.routes.set(key, plan);
    }
    if (!plan.cells) return undefined;
    if (probe) return { x: 0, z: 0 };
    const to = nav.steer(plan.cells, p.x, p.z);
    const hx = to.x - p.x, hz = to.z - p.z, n = Math.hypot(hx, hz);
    if (n < 1e-3) { const hx2 = x - p.x, hz2 = z - p.z, n2 = Math.hypot(hx2, hz2) || 1; return { x: hx2 / n2, z: hz2 / n2 }; }
    return { x: hx / n, z: hz / n };
  }

  /** Round 3e (VARIETY): a bot that has meant to move for most of a second
   *  and has not is caught on something: it jumps (a kerb, a crate's edge)
   *  and plans its route afresh. */
  private botStuck(a: Actor, mind: BotMind): boolean {
    const p = a.state, now = this.serverTime;
    if (Math.hypot(p.x - mind.stillX, p.z - mind.stillZ) > .35 || a.cast || a.reaction || !p.grounded) {
      mind.stillX = p.x; mind.stillZ = p.z; mind.stillSince = now;
      return false;
    }
    if (now - mind.stillSince < .9) return false;
    mind.stillSince = now; mind.routes.clear();
    return true;
  }

  /** Round 3e (VARIETY): whether a bot has a clear line to a body, chest to
   *  chest, for something that flies. */
  private botSight(a: Actor, o: Actor): boolean {
    if (!this.collision?.raycast) return true;
    const from = centreOf(a.state), to = centreOf(o.state), hit = this.collision.raycast(from, to);
    return Math.hypot(hit.x - to.x, hit.y - to.y, hit.z - to.z) < .1;
  }

  /** Round 3e (VARIETY): what a bot carries on with once its own blow has
   *  left the body reeling (a stagger or a spin-out): the heavy (or, now and
   *  then, the special) out of a string's finisher, the string out of a
   *  heavy. Undefined otherwise. */
  /** A bot with combo enders (combos.ts) ends a string that has landed with one, the more often the further the
   *  string has gone and the better the bot: off the floor the air strike, on it the blowback, the launcher, then the
   *  knockdown or - with the special ready - the stun. Undefined: the string goes on. */
  private botEnder(a: Actor, landed: Cast): AttackSlot | undefined {
    const p = a.state, chance = ([.06, .16, .3][landed.stage] ?? 0) + a.botSkill * .2;
    if (this.random() >= chance) return undefined;
    if (!p.grounded) return 'heavy';
    return landed.stage === 2 && p.cooldowns.special <= this.serverTime && this.random() < .45 ? 'special' : 'heavy';
  }

  private botFollowUp(a: Actor, other: Actor): AttackSlot | undefined {
    const cast = a.cast, q = other;
    if (!cast?.connected || a.kit) return undefined;
    const reeling = q.reaction === 'hurt' && this.serverTime - (q.staggeredAt ?? -Infinity) < .6 && q.stunUntil - this.serverTime > .25;
    if (!reeling) return undefined;
    if (cast.slot === 'light' && cast.stage >= RUSH_STAGES - 1) return this.serverTime > a.state.cooldowns.special && this.random() < .3 ? 'special' : 'heavy';
    if (cast.slot === 'heavy') return 'light';
    return undefined;
  }

  /** Round 3d (PACE): whether a dash about to start is a chase that goes out
   *  on an empty bar (STAMINA_OVERDRAW) - the light that is the chase, or a
   *  dash inside the chase window at the body the fighter's own launch sent
   *  up, in range - rather than a plain dash, which still needs its 20. */
  private chaseOverdraws(a: Actor, lightChase: Actor | undefined) {
    if (!STAMINA_OVERDRAW) return false;
    const chased = lightChase ?? (this.serverTime <= a.chaseUntil && a.chaseTargetId ? this.actors.get(a.chaseTargetId) : undefined);
    return !!chased?.state.alive && distance(a.state, chased.state) <= CHASE_RANGE;
  }

  private botDefend(a: Actor) {
    const p = a.state, now = this.serverTime;
    if (a.botGuardUntil !== undefined && now >= a.botGuardUntil) { a.botGuardFrom = a.botGuardUntil = undefined; a.botTimed = false; }
    let want = this.botGuarding(a);
    // A guard that is only being raised - a block or a turtle - is held back
    // while a blow is about to land inside the parry window: that press would
    // be a parry nobody timed. Only a timed parry goes on the beat. (Parry for
    // people: such a press opens no window now, and the hold-back stays at
    // BOT_GUARD_LEAD - the old window and a beat - so bots block as before.)
    if (want && !a.input.guard && !a.botTimed) { const soon = this.incomingMelee(a); if (soon !== undefined && soon <= BOT_GUARD_LEAD) want = false; }
    if (want !== !!a.input.guard || want && now - a.lastInputAt > .2)
      this.submitInput(p.id, { seq: a.lastSeq + 1, moveX: want ? 0 : a.input.moveX, moveZ: want ? 0 : a.input.moveZ, yaw: a.input.yaw,
        targetId: a.input.targetId, guard: want });
    if (a.botTimed || a.cast || a.reaction || now < a.stunUntil || now < a.dashUntil) return;
    for (const other of this.actors.values()) {
      const melee = this.meleeDue(a, other);
      const shot = melee === undefined ? this.shotDue(a, other) : undefined;
      const due = melee ?? shot?.due;
      if (due === undefined || due > BOT_READ) continue;
      const cast = other.cast, move = melee !== undefined ? cast!.move : shot!.shot.move;
      const read = melee !== undefined ? `${other.state.id}:${cast!.id}:${cast!.nextContact}` : `${other.state.id}:shot:${shot!.shot.castId}`;
      if (a.botRead === read) continue;
      a.botRead = read;
      // Parry for people: when the blow could first be seen - its swing's start, or a shot's wind-up while it is
      // still in the hand's cast, else its flight.
      const thrown = melee !== undefined ? cast!.start : cast && cast.id === shot!.shot.castId ? cast.start : shot!.shot.startAt;
      this.botAnswer(a, due, move, melee !== undefined ? cast!.slot : shot!.shot.slot, thrown, read);
      return;
    }
  }

  /** Round 5 (PARRY): a bot's answer to one blow it has read, `due` seconds
   *  out: a timed parry (off a guard it is already holding only if it can let
   *  go for PARRY_REARM first, the way a player re-presses), a block - raised
   *  now, or the guard it holds kept up through the blow - or nothing (it
   *  trades, or it takes it). True when it planned a guard.
   *
   *  Parry for people: the parry is pressed no sooner than the bot could have
   *  reacted to the blow, `thrown` being when it could first be seen
   *  (BOT_REACTION), and lands round BOT_PARRY_LEAD before the blow with a
   *  person's spread (BOT_TIMING). One it cannot reach in time - a jab, mostly -
   *  it answers as it would have without the parry: a block, or nothing. */
  private botAnswer(a: Actor, due: number, move: MoveDefinition, slot: AttackSlot, thrown = this.serverTime, read = '') {
    if (slot === 'ultimate') return false;
    const now = this.serverTime, skill = a.botSkill, roll = this.random();
    const holding = this.botGuarding(a);
    // A guard on an empty bar breaks on the first blow it takes (the stamina
    // a bot spends on dashes and swings is its guard too): it does not raise
    // one it cannot hold, and it parries only with something in reserve.
    if (a.state.stamina < BOT_GUARD_STAMINA * .4) return false;
    // Techniques: a route it knows (familiarity) it parries and blocks more.
    const known = this.familiarity(a);
    const parry = BOT_PARRY[0] + (BOT_PARRY[1] - BOT_PARRY[0]) * skill + READ_PARRY * known;
    const block = BOT_BLOCK[0] + (BOT_BLOCK[1] - BOT_BLOCK[0]) * skill + READ_BLOCK * known;
    if (roll < parry) {
      const spread = BOT_TIMING[0] + (BOT_TIMING[1] - BOT_TIMING[0]) * skill;
      const aim = now + due - (BOT_PARRY_LEAD + this.gauss() * spread);
      const reacts = thrown + BOT_REACTION[0] + (BOT_REACTION[1] - BOT_REACTION[0]) * skill
        + BOT_REACTION_SPREAD * unitSpread(`${a.state.id}:${read}`);
      const press = Math.max(now, aim, reacts);
      if (press < now + due && (!holding || press - now >= PARRY_REARM)) {
        a.botGuardFrom = press; a.botGuardUntil = now + due + .3; a.botTimed = true;
        return true;
      }
    }
    if (holding) { a.botGuardUntil = Math.max(a.botGuardUntil!, now + due + .3); return true; }
    if (!move.guardBreak && roll < parry + block && due > BOT_GUARD_LEAD && a.state.stamina >= BOT_GUARD_STAMINA) {
      // Raised now, well before the blow: a block, not a parry.
      a.botGuardFrom = now; a.botGuardUntil = now + due + .3;
      return true;
    }
    return false;
  }

  /** Round 5 (PARRY): whether a bot means to be holding its guard now. */
  private botGuarding(a: Actor) {
    return a.botGuardUntil !== undefined && this.serverTime >= a.botGuardFrom! && this.serverTime < a.botGuardUntil;
  }

  /** Round 5 (PARRY): a person's timing error, roughly normal with a spread
   *  of one, off the simulation's own seeded stream. */
  private gauss() { return (this.random() + this.random() + this.random() + this.random() - 2) * 1.732; }

  /** Round 5 (PARRY): seconds until a shot `other` threw reaches `a`, if one
   *  is on its way to them - the moment its path comes closest to their
   *  centre, when that is close enough to land. What a bot reads a shot by. */
  private shotDue(a: Actor, other: Actor): { due: number; shot: Projectile } | undefined {
    if (other === a || !this.hostile(other.state, a.state)) return undefined;
    const c = centreOf(a.state);
    for (const shot of this.projectiles) {
      if (shot.actorId !== other.state.id || shot.move.style !== 'projectile') continue;
      const dx = shot.end.x - shot.start.x, dy = shot.end.y - shot.start.y, dz = shot.end.z - shot.start.z;
      const span2 = dx * dx + dy * dy + dz * dz;
      if (span2 < 1e-6) continue;
      const t = clamp(((c.x - shot.start.x) * dx + (c.y - shot.start.y) * dy + (c.z - shot.start.z) * dz) / span2, 0, 1);
      const gap = Math.hypot(shot.start.x + dx * t - c.x, shot.start.y + dy * t - c.y, shot.start.z + dz * t - c.z);
      if (gap > shot.move.radius + radiusOf(a.state)) continue;
      const due = shot.startAt + t * shot.duration - this.serverTime;
      if (due > 0) return { due, shot };
    }
    return undefined;
  }

  /** Seconds until `other`'s next melee contact could land on `a`, if one is
   *  coming and `a` is inside its reach. What a bot reads a swing by. */
  private meleeDue(a: Actor, other: Actor): number | undefined {
    const cast = other.cast;
    if (other === a || !cast || cast.move.style !== 'melee' || !other.state.alive || cast.nextContact >= cast.move.contacts.length
      || !this.hostile(other.state, a.state)) return undefined;
    const due = cast.start + cast.move.contacts[cast.nextContact] - this.serverTime;
    if (due < 0 || distance(a.state, other.state) > this.reachOf(other, cast.slot, cast.move, !cast.airborne) + .6) return undefined;
    return due;
  }

  /** The soonest melee contact heading for `a` in the next 0.4 s. */
  private incomingMelee(a: Actor): number | undefined {
    let soonest: number | undefined;
    for (const other of this.actors.values()) {
      const due = this.meleeDue(a, other);
      if (due !== undefined && due < .4 && (soonest === undefined || due < soonest)) soonest = due;
    }
    return soonest;
  }

  private separateBodies(dt: number) {
    const living = [...this.actors.values()].filter(a => a.state.alive);
    const { halfX, halfZ } = this.bounds;
    /** Move one body `amount` along (ux, uz) through the world and inside the
     *  stage, and report how far along it really went. */
    const shove = (actor: Actor, ux: number, uz: number, amount: number) => {
      const p = actor.state;
      if (amount <= 1e-6 || p.timeStopped) return 0;
      const delta = { x: ux * amount, y: 0, z: uz * amount };
      const resolved = this.collision?.move(p.id, p, delta) ?? delta;
      const x = clamp(p.x + resolved.x, -halfX + PLAYER_RADIUS, halfX - PLAYER_RADIUS);
      const z = clamp(p.z + resolved.z, -halfZ + PLAYER_RADIUS, halfZ - PLAYER_RADIUS);
      const went = (x - p.x) * ux + (z - p.z) * uz;
      p.x = x; p.z = z;
      return Math.max(0, went);
    };
    // Who gives ground. A fighter committed to a move holds theirs, and one
    // the reaction owns gives up more of it - which is what being hit looks
    // like when the person who hit you keeps walking in.
    // A transformation holds its ground outright. It is invulnerable and it
    // is meant to be still; being shoved across the floor by whoever walked
    // into it is neither.
    const footing = (actor: Actor) => actor.state.action === 'awaken' ? 0
      : actor.cast ? .3 : this.serverTime < actor.stunUntil ? 1.4 : 1;
    for (let i = 0; i < living.length; i++) for (let j = i + 1; j < living.length; j++) {
      const actorA = living[i], actorB = living[j];
      const a = actorA.state, b = actorB.state;
      // Half a body height rather than a whole one, with the push reduced
      // for whoever is off the ground: a juggled fighter used to hang inside
      // the person juggling them, which is the one exchange the camera is
      // pointed at.
      const gap = Math.abs(a.y - b.y);
      if (gap > 1.5) continue;
      // An iai dash runs through whoever it was aimed at; they are pushed
      // apart again once it has cut.
      if (this.passing(actorA) || this.passing(actorB)) continue;
      const airborne = gap > .9 || !a.grounded || !b.grounded;
      let dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
      const ux = d > 0.001 ? dx / d : 1, uz = d > 0.001 ? dz / d : 0;
      // A move with blades fanned round its thrower holds everybody out at
      // their length (MoveDefinition.spacing): the thrower keeps their ground
      // and the other is eased back out at SPACING_PUSH, not flung.
      const holdA = this.spacing(actorA), holdB = this.spacing(actorB), hold = Math.max(holdA, holdB);
      if (hold > pushOf(a) + pushOf(b) && d < hold) {
        const [pusher, pushed, sign] = holdA >= holdB ? [actorA, actorB, 1] as const : [actorB, actorA, -1] as const;
        if (footing(pushed) > 0 && pusher.state.alive) shove(pushed, ux * sign, uz * sign, Math.min(hold - d, SPACING_PUSH * dt));
        dx = b.x - a.x; dz = b.z - a.z; d = Math.hypot(dx, dz);
      }
      const overlap = pushOf(a) + pushOf(b) - d;
      // A dead zone and a partial resolve. Clearing the whole overlap every
      // tick, split evenly, makes two fighters walking into each other shove
      // one another back and forth every frame; a millimetre of contact is not
      // worth moving anybody for.
      if (overlap <= .02) continue;
      // What the pair resolves this tick: 1.2 of the overlap on the ground,
      // 0.48 with either of them off it - but never leaving two bodies whose
      // heights overlap closer than HARD_GAP, however hard a chase, a juggle or
      // a wall drives them together.
      let resolve = overlap * (airborne ? .48 : 1.2);
      const hardGap = a.size || b.size ? HARD_GAP * (pushOf(a) + pushOf(b)) / (PUSH_RADIUS * 2) : HARD_GAP;
      if (gap < .9 && d + resolve < hardGap) resolve = hardGap - d;
      const weightA = footing(actorA), weightB = footing(actorB), total = weightA + weightB;
      // Stopped time holds a body where it is; the other takes the whole push.
      const shareA = a.timeStopped ? 0 : b.timeStopped ? 1 : total > 0 ? weightA / total : .5;
      // Rigid: whatever one body cannot give - a wall, the stage edge, stopped
      // time - the other gives instead. The split used to be all there was, so
      // a committed attacker (footing 0.3) walking a victim into a wall held
      // the pair a body-width inside each other.
      const wantA = resolve * shareA, wantB = resolve - wantA;
      const wentA = shove(actorA, -ux, -uz, wantA);
      const wentB = shove(actorB, ux, uz, wantB + (wantA - wentA));
      const short = wantB + (wantA - wentA) - wentB;
      if (short > 1e-4) shove(actorA, -ux, -uz, short);
    }
  }

  private checkWinner() {
    if (this.roomMode !== 'match' || this.status !== 'active') return;
    const alive = [...this.actors.values()].filter(a => a.state.alive);
    if (alive.length <= 1) {
      this.status = 'finished'; this.winnerId = alive[0]?.state.id ?? null;
      this.projectiles.length = 0;
      for (const actor of this.actors.values()) actor.cast = null;
      // The winner celebrates. He used to fall through to `idle` and stand
      // there, which on a rig whose idle is a combat stance reads as the game
      // having stopped rather than having been won. Four of the ten ship a
      // victory animation and the rest fall back to their idle, which is no
      // worse than what they all did before.
      const champion = alive[0];
      if (champion) this.action(champion, 'victory');
      this.emit({ kind: 'winner', actorId: this.winnerId ?? 'draw' });
    }
  }

  /** Round 3: a time-stop ultimate crosses its stop (src/game/timeStopBarrage.ts).
   *
   *  Called at the top of updateCast, before any contact is dealt with. On
   *  the tick the clock stops it notes when and where - the freeze loop in
   *  updateCast then stops it, untouched. On the next it plans the tour from
   *  whoever that loop caught. From then on it holds the user, moves him
   *  from victim to victim, and lands the tour's blows and its finisher
   *  itself, so the loop only ever sees the stop. A stop that caught nobody
   *  leaves every contact to the loop: the blows swing at the air in front,
   *  as any melee does. True when the cast is over (a blow can end it).
   *
   *  Round 3d (ULTS): the stop is a hit-confirm ultimate's opener. One that
   *  catches somebody confirms as the tour is planned (stopTaken) - everybody
   *  it caught is held and shielded until the finisher lets them go, and so
   *  is the user - and one that catches nobody is a whiff: the move ends
   *  WHIFF_RECOVERY later. Arcade survival's sides keep the old rule above.
   *
   *  Round 4b (FMOVES): whoever the stop froze is toured - a kit-bodied grunt
   *  (Last Stand's raiders, the Rift's bosses and champions) and the horde
   *  (the arena's ExternalTargets) as well as the roster - so a stop on a
   *  side among grunts no longer swings at the air in front with a melee
   *  reach of about a metre, and a stop that froze only grunts is no whiff.
   *  A dome (TourStyle.domain) holds what is inside it while it stands
   *  (domainHold). */
  private timeStopTour(a: Actor, cast: Cast): boolean {
    const move = cast.move, stop = move.timeStop, p = a.state;
    // The move's own tour where it brings one (a stop the Forge lent another body), else the thrower's.
    const style = a.kit ? undefined : stop?.tour ?? TIME_STOP_TOURS[p.fighter];
    if (!stop || !style || !tourContacts(move)) return false;
    const age = this.serverTime - cast.start;
    if (!cast.tour) {
      if (cast.nextContact === stop.contact && age >= move.contacts[stop.contact]) cast.tour = { at: this.serverTime, from: position(p), visit: -1 };
      return false;
    }
    const tour = cast.tour;
    if (tour.done) return false;
    if (!tour.order) {
      // Round 3e (ULTFIX): whom the stop caught is the server's to say.
      if (this.follows) return this.awaitVerdict(cast);
      this.planTimeStopTour(a, cast, tour); this.stopTaken(a, cast, tour);
    }
    if (style.domain) this.domainHold(a, cast, tour);
    const order = tour.order!, visited = tour.visited ?? 0;
    if (!order.length) return false;
    if (cast.cine && !cast.cine.done) this.shieldTour(a, cast);
    const visits = visitCount(move, style, visited);
    let k = tour.visit;
    while (k + 1 < visits && age >= blinkWindow(move, k + 1, visits, style)[0]) k++;
    if (k > tour.visit) this.beginTourMove(a, tour, style, k);
    // Held where the tour puts him: the stick does not walk him out of it,
    // and nothing that was carrying him when the clock stopped carries on.
    const [start, end] = tour.visit >= 0 ? blinkWindow(move, tour.visit, visits, style) : [0, 0];
    const from = tour.moveFrom ?? tour.from, to = tour.moveTo ?? tour.from;
    const u = tour.visit < 0 ? 0 : end > start ? clamp((age - start) / (end - start), 0, 1) : 1;
    const w = tour.teleport ? (u >= 1 ? 1 : 0) : u * u * (3 - 2 * u);
    p.x = from.x + (to.x - from.x) * w; p.y = from.y + (to.y - from.y) * w; p.z = from.z + (to.z - from.z) * w;
    a.mx = a.mz = a.kx = a.kz = a.vy = 0;
    const facing = tour.visit >= 0 ? this.tourBody(order[visitVictim(move, style, tour.visit, visited)]) : undefined;
    if (facing) {
      const dx = facing.x - p.x, dz = facing.z - p.z, n = Math.hypot(dx, dz);
      if (n > 1e-3) { p.yaw = Math.atan2(dx, dz); cast.direction = { x: dx / n, y: 0, z: dz / n }; }
    }
    const last = move.contacts.length - 1;
    while (cast.nextContact > stop.contact && cast.nextContact <= last && age >= move.contacts[cast.nextContact]) {
      const contact = cast.nextContact++;
      if (contact === last) {
        tour.done = true; this.finishTimeStopTour(a, cast, tour);
        if (cast.cine && !cast.cine.done) this.releaseHold(a, cast); // Round 3d (ULTS): the clock starts, the hold lets go.
        return a.cast !== cast;
      }
      const index = visitVictim(move, style, visitOf(move, contact, visits), visited);
      const id: string | undefined = order[index], origin = centre(p);
      const victim = id === undefined ? undefined : this.actors.get(id), body = victim || id === undefined ? undefined : this.external?.locate(id);
      this.emit({ kind: 'release', actorId: p.id, fighter: p.fighter, slot: cast.slot, origin,
        endpoint: victim ? centreOf(victim.state) : body ? { x: body.x, y: body.y + body.height * .55, z: body.z } : position(origin), contactIndex: contact });
      if (victim ? !victim.state.alive : !body) continue;
      tour.struck![index] = position(p);
      // In stopped time the blows keep the tour's beat: the user is not held
      // in each one's impact freeze, which would push the last of them past
      // the clock starting again.
      const heldFrom = a.hitstopFrom, heldUntil = a.hitstopUntil;
      if (victim) this.holdHit(a, cast, victim, contact, false, origin);
      else this.hitExternal(p.id, body!, cast.slot, cast.cine ? scheduled(move, contact) : move, origin, false, contact, cast.id, cast.stage);
      a.hitstopFrom = heldFrom; a.hitstopUntil = heldUntil;
      if (a.cast !== cast) return true;
    }
    return false;
  }

  /** Round 4b (FMOVES): where a body a stop caught stands now - a fighter, or
   *  a horde body the arena's external targets know - or undefined when it is
   *  gone (down, or out of the horde). */
  private tourBody(id: string): Vec3 | undefined {
    const victim = this.actors.get(id);
    if (victim) return victim.state.alive ? victim.state : undefined;
    const body = this.external?.locate(id);
    return body ? { x: body.x, y: body.y, z: body.z } : undefined;
  }

  /** Who the stop caught - the hostile bodies the freeze loop froze with this
   *  stop, inside its radius - ordered into a tour (planTour). Round 4b
   *  (FMOVES): a body with a kit as well (it used to be left to the old
   *  sweep, and so were the horde's, which `freeze` stops but nothing struck):
   *  the horde inside the radius as the freeze took it (Horde.freeze, along
   *  the floor), the lock - or the horde body chosen - first in line to be
   *  the primary. */
  private planTimeStopTour(a: Actor, cast: Cast, tour: TimeStopTour) {
    const stop = cast.move.timeStop!, p = a.state, origin = centre(tour.from), until = tour.at + stop.duration - .05;
    const caught: { id: string; x: number; z: number }[] = [];
    for (const other of this.actors.values()) {
      const q = other.state;
      if (!this.hostile(p, q) || !q.alive || other.freezeUntil < until || distance(origin, centreOf(q)) > stop.radius + .01) continue;
      caught.push({ id: q.id, x: q.x, z: q.z });
    }
    if (this.external) {
      const n = this.external.query(origin, origin, stop.radius + 1.2, this.nearby);
      for (let i = 0; i < n; i++) {
        const body = this.nearby[i];
        if (this.external.hostile?.(p.id,body)===false || Math.hypot(body.x - origin.x, body.z - origin.z) > stop.radius || this.actors.has(body.id)) continue;
        caught.push({ id: body.id, x: body.x, z: body.z });
      }
    }
    const plan = planTour(tour.from, cast.direction, caught, p.target ?? a.chosenExternal, tourBlows(cast.move));
    tour.order = plan.order; tour.visited = plan.visited; tour.struck = plan.order.map(() => null);
  }

  /** Round 4b (FMOVES): a dome (TourStyle.domain), each tick it stands -
   *  from the tick it closed until the clock starts again. Whoever is inside
   *  it and was not caught as it closed - shielded then by a dash's evasion,
   *  a getting-up, a respawn, or not yet inside - is caught on the first tick
   *  they are inside and nothing shields them: frozen until it opens, held
   *  with the rest when the stop is a confirmed hold, and released with the
   *  finisher (the tour's order grows; whom it visits does not). The horde is
   *  frozen again over the radius each tick, so a grunt that walks in stops
   *  too (Horde.freeze), and every grunt inside is struck as the clock starts
   *  (finishTimeStopTour). */
  private domainHold(a: Actor, cast: Cast, tour: TimeStopTour) {
    const stop = cast.move.timeStop!, until = tour.at + stop.duration, left = until - this.serverTime;
    if (left <= .05 || !tour.order) return;
    const p = a.state, origin = centre(tour.from), order = tour.order, cine = cast.cine && !cast.cine.done ? cast.cine : undefined;
    for (const other of this.actors.values()) {
      const q = other.state;
      if (other === a || !this.hostile(p, q) || !q.alive || this.serverTime < other.evadeUntil || other.freezeUntil >= until - .05
        || this.floorDodges(other, cast.slot, this.fighterBlow(a, other)) // Ground hits: as the stop's own catch (updateCast).
        || distance(origin, centreOf(q)) > stop.radius || order.includes(q.id)) continue;
      other.freezeUntil = until; q.timeStopped = true;
      order.push(q.id); tour.struck!.push(null);
      if (cine) { cine.ids.push(q.id); cine.evade.push(other.evadeUntil); q.heldBy = p.id; a.holding?.ids.push(q.id); }
    }
    this.external?.freeze(origin, stop.radius, left,p.id);
  }

  /** Start the move into visit `k`: to a legal spot beside its victim
   *  (tourSpot), a glide if the style glides and the way is clear, else one
   *  step. With nowhere legal to stand the user stays where he is, and the
   *  blows land from there: the stop is his, and the spirit reaches. */
  private beginTourMove(a: Actor, tour: TimeStopTour, style: TourStyle, k: number) {
    const move = a.cast!.move, p = a.state, visited = tour.visited ?? 0;
    tour.visit = k;
    const id = tour.order![visitVictim(move, style, k, visited)], victim = this.actors.get(id);
    const body = victim ? undefined : this.external?.locate(id);
    // A body bigger than a fighter is struck from as much further off as it is wider (a giant's pushbox, a brute's).
    const spot = victim?.state.alive ? this.tourSpot(a, victim.state, centreOf(victim.state), Math.max(0, pushOf(victim.state) - PUSH_RADIUS), style, priorVisits(move, style, k, visited))
      : body ? this.tourSpot(a, body, { x: body.x, y: body.y + body.height * .55, z: body.z }, Math.max(0, body.radius - PLAYER_RADIUS), style, priorVisits(move, style, k, visited)) : null;
    tour.moveFrom = position(p);
    tour.moveTo = spot ?? position(p);
    tour.teleport = !style.glide || !spot || !this.tourPathClear(a, p, spot);
  }

  /** Where to stand to strike a body standing at `q` (its middle at
   *  `middle`, and `girth` metres wider than a fighter's pushbox): that much
   *  further than `style.strike` from them, on the side facing the user -
   *  turned further round when they have been visited before - else the
   *  nearest side round them that is inside the stage, not cut short by a
   *  wall, in sight of them and a pushbox clear of every other body: the
   *  rigid spacing is never broken to make room. Null when no side is. The
   *  same capsule sweep and line of sight a vanish uses. */
  private tourSpot(a: Actor, q: Vec3, middle: Vec3, girth: number, style: TourStyle, prior: number): Vec3 | null {
    const p = a.state, { halfX, halfZ } = this.bounds, strike = style.strike + girth;
    const base = Math.atan2(p.x - q.x, p.z - q.z) + (prior > 0 ? REVISIT_TURN : 0);
    for (let i = 0; i < 12; i++) {
      const angle = base + Math.ceil(i / 2) * (i % 2 ? 1 : -1) * Math.PI / 6;
      const wanted = { x: Math.sin(angle) * strike, y: 0, z: Math.cos(angle) * strike };
      const moved = this.collision?.move(p.id, q, wanted) ?? wanted;
      const to = { x: clamp(q.x + moved.x, -halfX + PLAYER_RADIUS, halfX - PLAYER_RADIUS), y: q.y + (this.collision ? moved.y : 0),
        z: clamp(q.z + moved.z, -halfZ + PLAYER_RADIUS, halfZ - PLAYER_RADIUS) };
      if (Math.hypot(to.x - q.x, to.z - q.z) < strike - .2) continue;
      const sight = this.collision?.raycast?.(middle, centre(to));
      if (sight && distance(sight, centre(to)) > .1) continue;
      let clear = true;
      for (const other of this.actors.values()) {
        const o = other.state;
        if (other === a || !o.alive || Math.abs(o.y - to.y) >= 1.5) continue;
        if (Math.hypot(o.x - to.x, o.z - to.z) < pushOf(p) + pushOf(o) + .05) { clear = false; break; }
      }
      if (clear) return to;
    }
    return null;
  }

  /** Whether a glide from `from` to `to` crosses open floor: nothing solid on
   *  the line, and nobody's pushbox across it. */
  private tourPathClear(a: Actor, from: Vec3, to: Vec3) {
    const sight = this.collision?.raycast?.(centre(from), centre(to));
    if (sight && distance(sight, centre(to)) > .1) return false;
    const flatFrom = { x: from.x, y: 0, z: from.z }, flatTo = { x: to.x, y: 0, z: to.z };
    for (const other of this.actors.values()) {
      const o = other.state;
      if (other === a || !o.alive || Math.abs(o.y - from.y) >= 1.5) continue;
      if (segmentDistance({ x: o.x, y: 0, z: o.z }, flatFrom, flatTo) < pushOf(a.state) + pushOf(o) - .1) return false;
    }
    return true;
  }

  private finishTimeStopTour(a: Actor, cast: Cast, tour: TimeStopTour) {
    const move = cast.move, last = move.contacts.length - 1, p = a.state, order = tour.order!, primary = (tour.visited ?? 1) - 1;
    // A dome that closed on nobody has no primary (visited 0): whoever walked into it is released with the rest.
    const origin = centre(p), primaryId: string | undefined = order[primary], target = primaryId === undefined ? undefined : this.actors.get(primaryId);
    const primaryBody = target || primaryId === undefined ? undefined : this.external?.locate(primaryId);
    this.emit({ kind: 'release', actorId: p.id, fighter: p.fighter, slot: cast.slot, origin,
      endpoint: target ? centreOf(target.state) : primaryBody ? { x: primaryBody.x, y: primaryBody.y + primaryBody.height * .55, z: primaryBody.z } : position(origin), contactIndex: last });
    for (let i = 0; i < order.length; i++) {
      if (i === primary) continue;
      const victim = this.actors.get(order[i]), struck = tour.struck![i], from = centre(struck ?? tour.from);
      if (!victim) {
        const body = this.external?.locate(order[i]);
        if (body) this.hitExternal(p.id, body, cast.slot, move, from, true, last, cast.id, cast.stage);
        if (a.cast !== cast) return;
        continue;
      }
      if (!victim.state.alive) continue;
      if (struck) victim.lastDamageAt = this.serverTime;
      this.holdHit(a, cast, victim, last, true, from);
      if (a.cast !== cast) return;
    }
    if (this.external && (cast.move.timeStop?.tour ?? TIME_STOP_TOURS[p.fighter])?.domain && !a.kit) {
      const centreOfStop = centre(tour.from), stop = move.timeStop!;
      const n = this.external.query(centreOfStop, centreOfStop, stop.radius + 1.2, this.nearby), released = new Set(order);
      for (let i = 0; i < n; i++) {
        const body = this.nearby[i];
        if (this.external.hostile?.(p.id,body)===false || released.has(body.id) || Math.hypot(body.x - centreOfStop.x, body.z - centreOfStop.z) > stop.radius) continue;
        this.hitExternal(p.id, body, cast.slot, move, centreOfStop, true, last, cast.id, cast.stage);
        if (a.cast !== cast) return;
      }
    }
    if (target) {
      if (!target.state.alive) return;
      if (tour.struck![primary]) target.lastDamageAt = this.serverTime;
      this.holdHit(a, cast, target, last, true, origin);
    } else if (primaryBody) this.hitExternal(p.id, primaryBody, cast.slot, move, origin, true, last, cast.id, cast.stage);
  }

  /** Round 3d (ULTS): a hit-confirm ultimate (MoveDefinition.confirm), each
   *  tick of its cast before its contacts are looked at (the top of
   *  updateCast).
   *
   *  Until the opener has come due there is nothing to decide. After it, the
   *  first tick that knows how it went decides: landed on somebody - the
   *  bodies an opener lands on are its cast's `opened` - and the cinematic
   *  begins (confirmUltimate); found nobody, and the move is cut to end
   *  WHIFF_RECOVERY after this tick (whiffUltimate). A melee opener is not
   *  decided while its active frames are still open, nor a shot while it is
   *  still in the air. From the confirm on this plays the cinematic
   *  (playCinematic), and the loop in updateCast finds nothing left to do.
   *
   *  A time stop confirms or whiffs as its tour is planned (timeStopTour).
   *  Arcade survival's sides and any body with a kit throw their ultimates as
   *  they always did: every contact through the ordinary loop, hit or miss -
   *  that mode's crowd is its own to fight through. True when the cast is
   *  over. Allocates nothing until it decides. */
  private ultimateTick(a: Actor, cast: Cast): boolean {
    const move = cast.move, p = a.state;
    if (!move.confirm || cast.slot !== 'ultimate' || a.kit || p.team !== undefined || move.timeStop) return false;
    if (cast.cine) return this.playCinematic(a, cast);
    // A shot lands through `hit` as a finisher, whatever it is, so an opener
    // that is a shot flies as a move whose finisher is the opener; the whole
    // move comes back once it has landed or missed.
    if (move.style === 'projectile' && cast.nextContact === 0 && !cast.full) {
      cast.full = move;
      cast.move = { ...move, finisherDamage: move.damage, finisherStun: move.stun, finisherKnockback: move.knockback };
    }
    if (cast.whiff !== undefined || cast.nextContact === 0) return false;
    // Still out. Nothing after the opener is thrown while it is: an arrow in
    // the air when the cinematic's first beat comes due holds the beat.
    if (!cast.connected && this.openerPending(a, cast))
      return cast.nextContact < move.contacts.length && this.serverTime - cast.start >= move.contacts[cast.nextContact];
    // Round 3e (ULTFIX): the client's copy leaves the verdict to the server.
    if (this.follows) return this.awaitVerdict(cast);
    if (cast.full) { cast.move = cast.full; cast.full = undefined; }
    const held = cast.connected ? this.heldFor(a, cast) : undefined;
    if (!held?.length) { this.whiffUltimate(a, cast); return false; }
    this.confirmUltimate(a, cast, held);
    return this.playCinematic(a, cast);
  }

  /** Whether a hit-confirm ultimate's opener could still land: its hitbox is
   *  still open (a melee opener's active frames), or its shot is still in the
   *  air. */
  private openerPending(a: Actor, cast: Cast) {
    if (cast.live) for (const open of cast.live) if (open.index === 0 && this.serverTime <= open.until) return true;
    for (const shot of this.projectiles) if (shot.actorId === a.state.id && shot.castId === cast.id) return true;
    return false;
  }

  /** Whom a landed opener holds: everybody it landed on who is still up -
   *  the fighter it was thrown at first, then in the order it reached them.
   *  Not a body with a kit (arcade survival's enemies), nor anybody the
   *  breaker let out of it. */
  private heldFor(a: Actor, cast: Cast): Actor[] {
    const held: Actor[] = [], p = a.state;
    for (const id of cast.opened.keys()) {
      const victim = this.actors.get(id);
      if (!victim || victim.kit || !victim.state.alive || !this.hostile(p, victim.state)) continue;
      if (id === p.target) held.unshift(victim); else held.push(victim);
    }
    return held;
  }

  /** The opener landed: its cinematic begins. Everybody it caught is held -
   *  stunned, pinned where they were caught (holdSpot), and out of everybody
   *  else's reach until the finisher - and so is the thrower, whose cast
   *  nobody can interrupt now: a cinematic is uninterruptible,
   *  and in a royale nobody else joins in or takes the kill. The shield is
   *  evade, which every blow, shot, blast and time stop already respects. */
  private confirmUltimate(a: Actor, cast: Cast, held: Actor[]) {
    const p = a.state, ids: string[] = [], evade: number[] = [], pins: Vec3[] = [];
    for (const victim of held) {
      ids.push(victim.state.id); evade.push(victim.evadeUntil); pins.push(this.holdSpot(a, cast, victim));
      victim.state.heldBy = p.id;
    }
    cast.cine = { at: this.serverTime, ids, evade, pins, from: position(p), own: a.evadeUntil };
    a.holding = { cast: cast.id, ids: ids.slice() };
    p.confirmedAt = this.serverTime;
    const primary = held[0].state;
    this.emit({ kind: 'confirm', actorId: p.id, targetId: primary.id, fighter: p.fighter, slot: cast.slot, actionSeq: p.actionSeq,
      castAge: this.serverTime - cast.start, origin: position(p), endpoint: centreOf(primary), contactIndex: 0 });
  }

  /** Where the cinematic holds `victim`: where the opener caught them, eased
   *  out along the line from the thrower to the pushbox (or the move's own
   *  spacing) if the two were closer than that, as far as the world and the
   *  stage allow - so the separation never shoves the pair apart under the
   *  pin. */
  private holdSpot(a: Actor, cast: Cast, victim: Actor): Vec3 {
    const p = a.state, q = victim.state;
    const least = Math.max(pushOf(p) + pushOf(q) + .02, cast.move.spacing ?? 0);
    const dx = q.x - p.x, dz = q.z - p.z, gap = Math.hypot(dx, dz);
    if (gap >= least || Math.abs(q.y - p.y) >= 1.5) return position(q);
    const ux = gap > 1e-4 ? dx / gap : Math.sin(p.yaw), uz = gap > 1e-4 ? dz / gap : Math.cos(p.yaw);
    const wanted = { x: ux * (least - gap), y: 0, z: uz * (least - gap) };
    const moved = this.collision?.move(q.id, q, wanted) ?? wanted;
    const { halfX, halfZ } = this.bounds;
    return { x: clamp(q.x + moved.x, -halfX + PLAYER_RADIUS, halfX - PLAYER_RADIUS), y: q.y,
      z: clamp(q.z + moved.z, -halfZ + PLAYER_RADIUS, halfZ - PLAYER_RADIUS) };
  }

  /** One tick of a confirmed cinematic: the thrower and everybody held are
   *  kept where the confirm put them, facing, and the contacts that have
   *  come due land on the held - on nobody else, whoever else has walked
   *  into the blow - with the finisher, the last, letting them go. True when
   *  the cast is over. */
  private playCinematic(a: Actor, cast: Cast): boolean {
    const cine = cast.cine!, move = cast.move, p = a.state;
    if (cine.done) return false;
    const last = move.contacts.length - 1, age = this.serverTime - cast.start;
    const until = cast.start + move.contacts[last] + CINEMATIC_MARGIN;
    if (cine.from) { p.x = cine.from.x; p.y = cine.from.y; p.z = cine.from.z; }
    a.mx = a.mz = a.kx = a.kz = a.vy = 0;
    a.evadeUntil = Math.max(a.evadeUntil, until);
    let primary: PlayerState | undefined;
    for (let i = 0; i < cine.ids.length; i++) {
      const victim = this.actors.get(cine.ids[i]);
      if (!victim) continue;
      // Down mid-cinematic: no longer held, and not held again should the
      // body come back before the cast is over.
      if (!victim.state.alive) { this.dropHeld(a, cine, i); continue; }
      this.pinHeld(victim, cine.pins?.[i], until);
      primary ??= victim.state;
    }
    if (primary) {
      const dx = primary.x - p.x, dz = primary.z - p.z, n = Math.hypot(dx, dz);
      if (n > 1e-3) { p.yaw = Math.atan2(dx, dz); cast.direction = { x: dx / n, y: 0, z: dz / n }; }
    }
    while (cast.nextContact <= last && age >= move.contacts[cast.nextContact]) {
      const contact = cast.nextContact++, finisher = contact === last;
      const origin = centre(p);
      this.emit({ kind: 'release', actorId: p.id, fighter: p.fighter, slot: cast.slot, origin,
        endpoint: primary ? centreOf(primary) : position(origin), contactIndex: contact });
      for (let i = 0; i < cine.ids.length; i++) {
        const victim = this.actors.get(cine.ids[i]);
        if (!victim?.state.alive) continue;
        this.holdHit(a, cast, victim, contact, finisher, origin);
        if (a.cast !== cast) return true;
        if (!finisher && victim.state.alive) this.pinHeld(victim, cine.pins?.[i], until);
      }
      if (finisher) { this.releaseHold(a, cast); break; }
    }
    return false;
  }

  /** Keep somebody a cinematic holds where it holds them: nothing carries
   *  them off - not the blow's own knockback, not a dash - and they are
   *  stunned and out of everybody else's reach until `until`. */
  private pinHeld(victim: Actor, pin: Vec3 | undefined, until: number) {
    const q = victim.state;
    if (pin) { q.x = pin.x; q.y = pin.y; q.z = pin.z; }
    victim.kx = victim.kz = victim.vy = victim.mx = victim.mz = 0;
    victim.dashUntil = Math.min(victim.dashUntil, this.serverTime);
    victim.stunUntil = Math.max(victim.stunUntil, until);
    victim.evadeUntil = Math.max(victim.evadeUntil, until);
  }

  /** A time stop's hold, each tick of its tour: the stop freezes whoever it
   *  caught, and this keeps them - and the user crossing the field - out of
   *  everybody else's reach until the finisher, and the caught stunned
   *  through the tick between the clock starting and the finisher. */
  private shieldTour(a: Actor, cast: Cast) {
    const cine = cast.cine!, until = cast.start + cast.move.contacts[cast.move.contacts.length - 1] + CINEMATIC_MARGIN;
    a.evadeUntil = Math.max(a.evadeUntil, until);
    for (let i = 0; i < cine.ids.length; i++) {
      const victim = this.actors.get(cine.ids[i]);
      if (!victim) continue;
      if (!victim.state.alive) { this.dropHeld(a, cine, i); continue; }
      victim.stunUntil = Math.max(victim.stunUntil, until);
      victim.evadeUntil = Math.max(victim.evadeUntil, until);
    }
  }

  /** One of a cinematic's blows on somebody it holds: through `hit` like any
   *  other blow, with the hold's shield lifted for it - the victim's evade is
   *  what keeps everybody else off them - and no quiet spell counted between
   *  the blows of one hold, however long its thrower winds up (the Grand Tide
   *  Gun's fist takes most of two seconds to inflate). Without a cinematic
   *  (arcade survival's sides) it is the plain blow. */
  private holdHit(a: Actor, cast: Cast, victim: Actor, contact: number, finisher: boolean, origin: Vec3) {
    const id = a.state.id;
    if (!cast.cine) { this.hit(id, victim, cast.slot, cast.move, origin, finisher, origin, contact, cast.opened, cast.id, cast.stage); return; }
    const keep = victim.evadeUntil;
    victim.evadeUntil = -Infinity;
    if (cast.opened.has(victim.state.id)) victim.lastDamageAt = this.serverTime;
    this.hit(id, victim, cast.slot, scheduled(cast.move, contact), origin, finisher, origin, contact, cast.opened, cast.id, cast.stage); // Round 3e (ULTFIX): its own schedule.
    if (!finisher) victim.evadeUntil = Math.max(victim.evadeUntil, keep);
  }

  /** The finisher has landed: everybody held is let go - their own evade back,
   *  whatever the finisher left them in (a launch, a knockdown) - and the
   *  thrower is back within reach for their recovery. */
  private releaseHold(a: Actor, cast: Cast) {
    const cine = cast.cine!;
    cine.done = true;
    for (let i = 0; i < cine.ids.length; i++) {
      const victim = this.actors.get(cine.ids[i]);
      if (!victim) continue;
      if (victim.state.heldBy === a.state.id) victim.state.heldBy = undefined;
      victim.evadeUntil = Math.max(cine.evade[i], victim.evadeUntil);
    }
    a.evadeUntil = cine.own;
    a.holding = undefined;
  }

  /** Somebody a cinematic held has gone down in it: let go of, for good. */
  private dropHeld(a: Actor, cine: Cinematic, i: number) {
    const victim = this.actors.get(cine.ids[i]);
    if (victim?.state.heldBy === a.state.id) victim.state.heldBy = undefined;
    cine.ids[i] = '';
  }

  /** A time stop that has frozen somebody is a confirmed hit-confirm ultimate:
   *  the tour is its cinematic, and everybody the stop caught is held until
   *  its finisher - out of everybody else's reach, as the user is. One that
   *  caught nobody is a whiff. A side (arcade survival, the objective modes)
   *  holds nobody and never whiffs: its stop tours whom it froze - the crowd
   *  included since round 4b - and one that froze nobody swings at the air.
   *  (A horde body in the order is held by its freeze alone: nothing here
   *  reaches it.) */
  private stopTaken(a: Actor, cast: Cast, tour: TimeStopTour) {
    const p = a.state, order = tour.order!;
    if (!cast.move.confirm || a.kit || p.team !== undefined) return;
    if (!order.length) { this.whiffUltimate(a, cast); return; }
    const evade: number[] = [];
    for (const id of order) {
      const victim = this.actors.get(id);
      evade.push(victim ? victim.evadeUntil : -Infinity);
      if (victim) victim.state.heldBy = p.id;
    }
    cast.cine = { at: this.serverTime, ids: order.slice(), evade, own: a.evadeUntil };
    a.holding = { cast: cast.id, ids: order.slice() };
    p.confirmedAt = this.serverTime;
    const primary = this.actors.get(order[(tour.visited ?? 1) - 1])?.state;
    this.emit({ kind: 'confirm', actorId: p.id, targetId: primary?.id, fighter: p.fighter, slot: cast.slot, actionSeq: p.actionSeq,
      castAge: this.serverTime - cast.start, origin: position(p), endpoint: primary ? centreOf(primary) : undefined, contactIndex: cast.move.timeStop!.contact });
  }

  /** The opener found nobody: nothing after it is thrown, and the move ends
   *  WHIFF_RECOVERY (the move's `confirm.recovery`) from now. The bar was
   *  spent on the press. */
  private whiffUltimate(a: Actor, cast: Cast) {
    const p = a.state, age = this.serverTime - cast.start;
    cast.whiff = this.serverTime;
    p.whiffedAt = this.serverTime;
    cast.move = { ...cast.move, contacts: cast.move.contacts.slice(0, cast.nextContact),
      duration: Math.min(cast.move.duration, age + (cast.move.confirm?.recovery ?? 0)) };
    // Round 3e (ULTFIX): and whom it was thrown at, who is shown it missed.
    this.emit({ kind: 'whiff', actorId: p.id, targetId: p.target ?? undefined, fighter: p.fighter, slot: cast.slot, actionSeq: p.actionSeq, castAge: age, origin: position(p) });
  }

  /** Round 3d (ULTS), at the top of each fighter's tick. A hold its cinematic
   *  did not end itself - its thrower defeated, the room reset, the match
   *  won, the thrower gone - is let go of; and the thrower's confirm and
   *  whiff marks are cleared once the ultimate they belong to is over.
   *  Allocates nothing. */
  private cinematicTick(a: Actor) {
    const p = a.state, holding = a.holding;
    if (holding && (!a.cast || a.cast.id !== holding.cast || !a.cast.cine || a.cast.cine.done)) {
      a.holding = undefined;
      // Their shield runs out on its own, as the cinematic would have ended.
      for (const id of holding.ids) {
        const victim = this.actors.get(id);
        if (!victim || victim.state.heldBy !== p.id) continue;
        victim.state.heldBy = undefined;
        victim.stunUntil = Math.min(victim.stunUntil, this.serverTime + LET_GO_STUN);
      }
    }
    // A client's copy of the thrower carries no cast; there the hold ends
    // when the snapshot says so, or when the thrower is down or gone.
    if (p.heldBy !== undefined && !this.actors.get(p.heldBy)?.state.alive) p.heldBy = undefined;
    // Round 3e (ULTFIX): the marks are the ultimate's own, read off its cast
    // every tick: a cast put back from the server's checkpoint brings its
    // verdict with it, and the copy's own guess cannot outlive it.
    const ultimate = a.cast?.slot === 'ultimate' ? a.cast : undefined;
    const confirmedAt = ultimate?.cine?.at, whiffedAt = ultimate?.whiff;
    if (p.confirmedAt !== confirmedAt) p.confirmedAt = confirmedAt;
    if (p.whiffedAt !== whiffedAt) p.whiffedAt = whiffedAt;
  }

  /** Round 3e (ULTFIX): a simulation that has been handed an authority's
   *  checkpoint (restorePrediction) is the client's copy of that authority:
   *  the prediction. It plays what the player's own input decides at once -
   *  the press, the lunge, the opener's swing - and leaves what only the
   *  server can know to the server. Whether an ultimate's opener caught
   *  anybody is one of those: the copy sees every other fighter a round trip
   *  late, so a victim who stepped out of the opener was still inside it on
   *  the copy, which confirmed, and played the cinematic's grade, camera and
   *  time stop over a whiff (the probe: scripts/probe_ultimate_prediction.mts,
   *  nine of the thirty-nine laggy trials). A follower decides neither the
   *  confirm nor the whiff, nor whom a time stop caught; the server's verdict
   *  arrives with its next checkpoint, cast and all, and plays from there.
   *  The server - and every test that drives one simulation - is never a
   *  follower, and decides on the tick as before. */
  private follows = false;
  /** Night net: the shortcut for resting bodies on a follower (see `atRest`). Off only for the test that proves it changes nothing the local body does. */
  static restShortcut = true;
  /** Night net: whose copy this is (restorePrediction's id): the one body a follower always moves through the world. */
  private localId: string | undefined;

  /** Night net: a body that is standing on the floor with nothing moving it - no input velocity, no knockback, no
   *  reaction, no cast, not leaving the ground - for which the world's controller can only answer "stay". `dy` is the
   *  tick's gravity step: a resting body's is the small downward pull and nothing else. */
  private atRest(a: Actor, vx: number, vz: number, dy: number) {
    const p = a.state;
    return p.grounded && p.alive && !a.reaction && !a.cast && !a.jumping && !a.wallBounce && !a.dashChase && this.serverTime >= a.dashUntil
      && Math.abs(vx) < 1e-9 && Math.abs(vz) < 1e-9 && Math.hypot(a.kx, a.kz) < REST_DRIFT && dy <= 0 && dy > -.01;
  }

  /** Round 3e (ULTFIX): a follower's ultimate, past the moment its opener is
   *  decided: nothing after the opener is thrown until the server's verdict
   *  comes back in a checkpoint - the beat that comes due is held, as for an
   *  arrow still in the air. True when a contact is due (which ends
   *  updateCast's tick without throwing it). */
  private awaitVerdict(cast: Cast) {
    return cast.nextContact < cast.move.contacts.length && this.serverTime - cast.start >= cast.move.contacts[cast.nextContact];
  }

  predictionCheckpoint(id:string,share=false):PredictionCheckpoint|undefined {
    const actor=this.actors.get(id);if(!actor)return;
    const groups=new Map<Map<string,number>,number>();
    const opened=(map:Map<string,number>)=>{if(!groups.has(map))groups.set(map,groups.size);return {opened:[...map],openedGroup:groups.get(map)!};};
    const checkpoint:Record<string,unknown>={},own=actor as unknown as Record<string,unknown>;
    for(const key of Object.keys(own))if(key!=='state'&&key!=='cast'&&key!=='forged')checkpoint[key]=own[key];
    const cast=actor.cast;
    checkpoint.cast=cast?{...cast,...opened(cast.opened)}:null;
    checkpoint.shots=this.projectiles.filter(p=>p.actorId===id).map(p=>({...p,...opened(p.opened)}));
    return (share?checkpoint:structuredClone(checkpoint)) as PredictionCheckpoint;
  }

  restorePrediction(id:string,checkpoint:PredictionCheckpoint){
    this.follows = true; // Round 3e (ULTFIX): the client's copy (see `follows`).
    this.localId = id;
    const actor=this.actors.get(id);if(!actor)return;
    const {cast,shots,...rest}=structuredClone(checkpoint);
    const groups=new Map<number,Map<string,number>>();
    const opened=(value:{opened:[string,number][];openedGroup:number})=>{if(!groups.has(value.openedGroup))groups.set(value.openedGroup,new Map(value.opened));return groups.get(value.openedGroup)!;};
    Object.assign(actor,rest,{cast:cast?{...cast,opened:opened(cast)}:null});
    // (And the bodies a shot tore through, a set again: the wire carries it as an array - msgpackr - and the restored shot
    // called `pierced.has` on that: "n.pierced?.has is not a function", live, GET /errors; tests/predictionPierced.)
    this.projectiles=shots.map(p=>({...p,opened:opened(p),...(p.pierced?{pierced:new Set(p.pierced as Iterable<string>)}:{})}));
  }

  snapshot(drainEvents = false, withPrediction = false): GameSnapshot {
    const result: GameSnapshot = { players: [...this.actors.values()].map(a => ({ ...a.state, ackSeq: a.lastSeq,
      // Published here rather than at the top of the actor's tick: that runs
      // before hit resolution, so it would be a tick stale and would miss
      // exactly the contacts that land on a broadcast tick.
      hitstopFrom: a.hitstopFrom, hitstopUntil: a.hitstopUntil, cooldowns: { ...a.state.cooldowns } })),
      trainingBotMode: this.roomMode==='training'?this.trainingBotMode:undefined,
      trainingLab: this.roomMode==='training'&&this.actors.has('sparring-bot')?this.trainingLab.view():undefined,
      ...(this.roomMode==='training'&&this.pair?{trainingPair:[...this.pair] as [string,string]}:{}),
      reactions:Object.fromEntries([...this.actors].map(([id,a])=>[id,Object.fromEntries(REACTION_KEYS.map(key=>[key,a[key]])) as ReactionCheckpoint])),
      events: this.events.map(e => ({ ...e, origin: e.origin ? position(e.origin) : undefined, endpoint: e.endpoint ? position(e.endpoint) : undefined })),
      serverTime: this.serverTime, roomMode: this.roomMode, stage: this.stage, status: this.status, winnerId: this.winnerId, tick: this.tick,
      // Lock combat: said by the fight that plays it, so a page predicts it as its server plays it (unset otherwise).
      ...(this.lockCombat ? { lockCombat: true as const } : {}) };
    if(withPrediction)result.prediction=Object.fromEntries([...this.actors.keys()].map(id=>[id,this.predictionCheckpoint(id)!]));
    if (drainEvents) this.events.length = 0;
    return result;
  }

  dispose() { this.actors.clear(); this.projectiles.length = 0; this.events.length = 0; this.collision?.dispose?.(); }
}

export function segmentDistance(point: Vec3, from: Vec3, to: Vec3): number {
  const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
  const length2 = dx * dx + dy * dy + dz * dz;
  const t = length2 < 1e-8 ? 0 : clamp(((point.x - from.x) * dx + (point.y - from.y) * dy + (point.z - from.z) * dz) / length2, 0, 1);
  return Math.hypot(point.x - from.x - t * dx, point.y - from.y - t * dy, point.z - from.z - t * dz);
}
