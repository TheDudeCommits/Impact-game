import { CHOHAN_MOVES } from './fighters/chohan';
import { AQRAB_MOVES } from './fighters/aqrab';
import { TSUBUTE_MOVES } from './fighters/tsubute';
import { TIME_STOP_TOURS, type TourStyle } from './timeStopBarrage';
import { areaMoveOf } from '../engine/sim/areaMoves';
import { applyHouseKits } from '../engine/sim/houseKits';
import { PSYCHE_MOVES } from './fighters/psyche';
import { YODAKA_MOVES } from './fighters/yodaka';
import { OVID_MOVES } from './fighters/ovid';
import { HAWSER_MOVES, HAWSER_RUSH } from './fighters/hawser';
import { ROTFALKE_MOVES } from './fighters/rotfalke';
import { BONSHO_MOVES } from './fighters/bonsho';
import { MUREX_MOVES } from './fighters/murex';
import { KINU_MOVES } from './fighters/kinu';
import { MADAKE_MOVES } from './fighters/madake';
import { AKAYURI_MOVES } from './fighters/akayuri';
import { HAGURE_MOVES } from './fighters/hagure';
import { HISAME_MOVES } from './fighters/hisame';
import { MIZUHIKI_MOVES } from './fighters/mizuhiki';
import { SHIBUICHI_MOVES } from './fighters/shibuichi';
import { RAKUCHO_MOVES } from './fighters/rakucho';
import { IRBIS_MOVES } from './fighters/irbis';
import { SHIDARE_MOVES } from './fighters/shidare';
import { HINOMOTO_MOVES } from './fighters/hinomoto';
import { AMAGOI_MOVES } from './fighters/amagoi';
import { SHAKUDO_MOVES } from './fighters/shakudo';
import { MINASE_MOVES } from './fighters/minase';
import { ONIGAWARA_MOVES } from './fighters/onigawara';
import { CARDO_MOVES } from './fighters/cardo';
import { BRUIN_MOVES } from './fighters/bruin';
import { AQUILO_MOVES } from './fighters/aquilo';
import { SVANHILD_MOVES } from './fighters/svanhild';
import { KUBIWA_MOVES } from './fighters/kubiwa';
import { TORSION_MOVES } from './fighters/torsion';
import { HIGHSUN_MOVES } from './fighters/highsun';
import { LANTHORN_MOVES } from './fighters/lanthorn';
import { HIKUI_MOVES } from './fighters/hikui';
import { UME_MOVES } from './fighters/ume';
import { TOKAN_MOVES } from './fighters/tokan';
import { STRAPPADO_MOVES } from './fighters/strappado';
import { UNARI_MOVES } from './fighters/unari';
import { BARROW_MOVES } from './fighters/barrow';
import { SASHIGANE_MOVES } from './fighters/sashigane';
import { GOSU_MOVES } from './fighters/gosu';
import { KUSUSHI_MOVES } from './fighters/kusushi';
import { HAKUSHI_MOVES } from './fighters/hakushi';
import { SUZURAN_MOVES } from './fighters/suzuran';
import { WATAAME_MOVES } from './fighters/wataame';
import { SENKO_MOVES } from './fighters/senko';
import { BUNA_MOVES } from './fighters/buna';
import { OYASHIO_MOVES } from './fighters/oyashio';
import { ADAD_MOVES } from './fighters/adad';
import { SHIJIMA_MOVES } from './fighters/shijima';
import { AKAITO_MOVES } from './fighters/akaito';
import { TEMPO_MOVES } from './fighters/tempo';
import { TANCHO_MOVES } from './fighters/tancho';
import { BELLOWS_MOVES } from './fighters/bellows';
import { MIKAGE_MOVES } from './fighters/mikage';
import { FULL_BEAM_MOVES } from './fighters/full-beam';
import { PYROCLAST_MOVES } from './fighters/pyroclast';
import { AMPERE_MOVES } from './fighters/ampere';
import { SHANXIAO_MOVES } from './fighters/shanxiao';
import { KUZU_MOVES } from './fighters/kuzu';
import { SHAKUGO_MOVES } from './fighters/shakugo';
import { STRIX_MOVES } from './fighters/strix';
import { BASILISSA_MOVES } from './fighters/basilissa';
import { SORAYOMI_MOVES } from './fighters/sorayomi';
import { ENVIRONMENT_COLLIDERS } from './environmentLayout';
import contactReach from './data/contactReach.json';
import type { AttackSlot, FighterId } from './types';

export interface MoveDefinition {
  name: string;
  duration: number;
  contacts: number[];
  damage: number;
  range: number;
  radius: number;
  stamina: number;
  cooldown: number;
  stun: number;
  /** What the last contact is worth, where a move lands many. A barrage that
   *  paid its full damage on every hit would be worth ten times the move. */
  finisherDamage?: number;
  finisherStun?: number;
  knockback: number;
  finisherKnockback?: number;
  style: 'melee' | 'beam' | 'projectile' | 'bomb' | 'field';
  speed?: number;
  aimOnRelease?: boolean;
  guardBreak?: boolean;
  /** Thrown by something other than the fighter's own body - an arcade art
   *  striking across the field: its thrower does not share the hit-stop. */
  detached?: boolean;
  lunge?: number;
  /** Keep the formation phase planted before an automatic approach begins. */
  lungeDelay?: number;
  timeStop?: {contact:number;duration:number;radius:number;
    tour?: TourStyle};
  /** Where a shot is let go from, from the thrower's feet: metres to its right, ahead of it and up (Ikazuchi Arrow
   *  from the Guardian's bow). Unset, the body's centre. A move property, so a borrowed move keeps it (VOL.3). */
  origin?: {right:number;forward:number;up:number};
  /** Senpugan (VOL.3; once Konta's by name): through its live contact frames the palm is held out and the approach
   *  carries on, so a first contact tick that falls just short finishes that step instead of freezing the sphere
   *  centimetres outside the target. */
  palmHold?: boolean;
  /** Senpugan (VOL.3; once Konta's by name): the lunge locks onto the melee target the cast was aimed at. Only the
   *  slot's own move, unawakened and not a combo branch, as before. */
  lockAim?: boolean;
  status?: { kind: StatusKind; seconds: number; dps?: number; factor?: number };
  /** How far this move's approach will travel to reach somebody, when that is
   *  further than a normal step. A move whose whole idea is closing distance -
   *  a hit-confirm ultimate's lunging opener - needs the ground even though
   *  the blow itself lands at arm's length. */
  close?: number;
  /** Round 4b (GUMMY): a line thrown again and again at one body - the Hawk
   *  Gatling's fists. A beam's contacts are each thrown along the line from
   *  the thrower to where the fighter it is aimed at stands now, wherever
   *  that is within `track` radians of the line it was cast along and inside
   *  its range; anywhere else, along the cast's own line. (A beam's line is
   *  otherwise fixed at the cast.) */
  track?: number;
  /** How long this move's hitbox stays open once a contact comes due, in
   *  seconds. See ACTIVE_WINDOW. */
  active?: number;
  /** Impact freeze for this move's finisher, where it should land harder than
   *  its slot does: the rush finisher is a light that hits like a heavy. */
  hitstop?: number;
  /** Round 3e (VARIETY): what this move's finisher - its one blow, or the
   *  last of several - does to a body standing on the floor (see Outcome).
   *  Unset, it is what it always was: a launch from LAUNCH_KNOCKBACK up, a
   *  stagger below it. */
  outcome?: Outcome;
  /** Round 3e (VARIETY): how hard an outcome that leaves the floor throws
   *  the body up, m/s, where it should differ from the outcome's own
   *  (OUTCOME_LIFT): a rush stage's hop is a pop, a heavy's a juggle. */
  lift?: number;
  /** A charge-in move - Senpugan, Shrike Bolt, the Sickle Bolt, an iai draw -
   *  is charged at a distance and driven in so the blow lands on arrival. An
   *  opponent closer than this many metres, centre to centre, when the cast
   *  starts is backed away from during the early charge (see
   *  CHARGE_BACKSTEP_UNTIL): a short slide back rather than a charge held
   *  with a hip inside them. The approach then drives in as it always has. */
  chargeIn?: number;
  /** An iai draw: the blow is a dash straight through the target that ends
   *  DASH_THROUGH_PAST beyond them, and it cuts whoever lies on the path. The
   *  dash starts DASH_THROUGH_LEAD before the contact and arrives on it, so the
   *  contact time is the authored one. */
  dashThrough?: boolean;
  /** (combos.ts, 4 October) A ground smash: thrown in the air, the fighter
   *  hangs PLUNGE_HANG and drops at this many metres a second, and the first
   *  contact lands as the feet do - the cast's clock is set so its contact
   *  falls on the landing. A 'field' around where they land. */
  plunge?: number;
  /** (combos.ts) A combo ender: its reach is its own range, not the measured reach of the slot it is thrown from. */
  ender?: boolean;
  /** This move's own reach, metres from its thrower's centre to its striking surface at the frame it lands, where the
   *  move brings its figure with it rather than taking its fighter's measured one for the slot (contactReach.json,
   *  REACH_OVERRIDE): Scout Hawser throws Levin's kit and is given Levin's measured reach (fighters/hawser.ts), and the Attack
   *  Colossus he wakes into, another body with other moves in the same slots, must not inherit a blade's. Read by
   *  meleeReach; a light's is its rush stages' too. */
  reach?: number;
  /** Round 4b (COMBAT, combos.ts): a combo ender's own throw, where its fighter's differs from its outcome's -
   *  how long a body it puts on the floor stays down (OUTCOME_DOWN), and how long a dizzy holds (DIZZY_SECONDS). */
  down?: number;
  daze?: number;
  /** Round 4b (COMBAT): how a knockdown ender puts them down. 'slam', the outcome as it was: a short fall and a long
   *  stay. 'spike': driven into the floor - in the air hard enough to bounce once before it stays down, on its feet
   *  straight down where it stood (v71). 'slide': sent skidding
   *  away along the floor. 'splat': blown back into whatever is behind - a wall holds them (the wall splat), open
   *  floor is a long low flight. */
  knock?: 'slam' | 'spike' | 'slide' | 'splat';
  fling?: boolean;
  /** The distance, centre to centre, this move holds everybody at while it
   *  plays: the length of the blades a multi-blade ultimate fans out. Its
   *  approach stops there, and the separation eases anyone inside it back
   *  out at SPACING_PUSH while the thrower holds their ground. */
  spacing?: number;
  /** Cloudstep (round 3, Taisei's heavy). The thrower vanishes
   *  `vanish` seconds into the cast - gone from sight, evading and passed
   *  through by every body - and comes back at `appear`, `behind` metres from
   *  the body it went for (the lock, else the nearest body in front, up to
   *  `reach` metres away across the floor): behind their back and across
   *  them from where it left, facing them, so the blow that follows lands
   *  from behind. Every spot is swept through the world and kept a body's
   *  width clear of everyone, as a vanish is. Nobody in reach, it blinks
   *  `miss` metres straight ahead and whiffs.
   *  Round 7 (WARD ULT): `near` brings it back on the near side of them
   *  instead - between them and where it left, facing them - else to either
   *  side, else across them: Ward's Crossmatch, a swap into touch range down the
   *  line he threw it along (ULTIMATES.ward). */
  teleport?: { vanish: number; appear: number; reach: number; behind: number; miss: number; near?: boolean };
  confirm?: { recovery: number };
  schedule?: readonly number[];
  /** Techniques (techniques.ts, 2 November 2026). `evade`: seconds from the cast's start the thrower slips every blow
   *  (the sidestep). `armoured`: rides through a light or a heavy, under lock combat too (the charge). `stance`: from
   *  `from` to `to` seconds into the cast, a melee blow that meets the thrower from the front is answered - the blow
   *  undone, its thrower reeling, and this move's own blow thrown at once for COUNTER_DAMAGE times its worth. */
  evade?: number;
  armoured?: boolean;
  stance?: { from: number; to: number };
  area?: AreaSpec;
}

/** A body's moves by slot, where the area slot is optional: an arcade enemy's kit, or a table from before it. */
export type SlotMoves = Record<Exclude<AttackSlot, 'area'>, MoveDefinition> & { area?: MoveDefinition };

export interface AreaSpec {
  /** Seconds from the release (the move's first contact) to the first strike: the circle everyone sees fill. */
  telegraph: number;
  /** Pinned: how many strikes land, `interval` seconds apart, `damage` each and `finisherDamage` the last. Unpinned
   *  (the default), the strikes are the look's (`strikes`) and `damage` is the move's total, split across them. */
  hits?: number;
  interval?: number;
  fx?: string;
  /** When its strikes land, seconds after the first: its look's (areaStrikes.json), set with `fx` for a look that
   *  strikes more than once, unless `hits` or `interval` pins a schedule. Never authored. */
  strikes?: number[];
  /** How high over the floor the circle reaches, m (AREA_DEFAULTS.height): a body higher in the air is over it. */
  height?: number;
  anim?: Exclude<AttackSlot, 'area'> | AreaAnim;
  voice?: string;
  /** The move's name in Japanese, for the stamp's ring (presentation only). Unset: its element's kanji. */
  ja?: string;
  /** The move's name on its G card (src/ui/hud/cardNames.ts; presentation only): 16 characters or fewer, the name
   *  players know where its own is longer ("Great Waterfall"). Unset: its name. The cast banner and the seal's ring
   *  keep the full name. */
  card?: string;
  /** What the impact looks like, for the effect the page picks for it (src/engine/vfx/matcher.ts): one blast
   *  ('burst'), a field that lingers ('zone'), strikes from above ('rain') or a column ('pillar'). Default 'burst'. */
  look?: 'burst' | 'zone' | 'rain' | 'pillar';
}
/** An area cast's animation (AreaSpec.anim), in its object form. */
export interface AreaAnim { slot?: Exclude<AttackSlot, 'area'>; clip?: string; from?: FighterId; full?: boolean }
export { AREA_DEFAULTS } from '../engine/sim/areaMoves';

/** Round 3e (VARIETY): what a finisher does to the body it lands on. The
 *  third blind critic: "15 of 16 heavies and 14 of 16 specials launch the
 *  victim 5-10 m into a 1.5-2 s knockdown, so exchanges keep resetting to
 *  neutral", and every rush string ended the same way. Each move now says
 *  what it does - most of them keep the body close enough
 *  to carry on:
 *    launch        up and away, for the chase and the air string (the old
 *                  one, a little lower and shorter);
 *    hop           a short pop off the feet: the next blow juggles them;
 *    crumple       folds to the floor where they stood, up again quickly;
 *    stagger       reels in place, hurt for long enough to be hit again -
 *                  a heavy or a special cancelled from it lands;
 *    spin          spun round and sent reeling to the side;
 *    wallBounce    blown back along the floor; a wall throws them back off
 *                  it, up and into reach, instead of pinning them;
 *    groundBounce  driven into the floor, and up off it into a juggle;
 *    knockdown     (combos.ts, 4 October) thrown down hard: a short fall to
 *                  the floor and a long stay there - the string is over;
 *    dizzy         (combos.ts) left standing, dazed, for DIZZY_SECONDS: the
 *                  stun a guard break gives, earned by a string.
 *  A body already in the air is juggled as before (a groundBounce spikes
 *  it down, a wallBounce still bounces). The throws never apply to an
 *  anchored body, and a guard break, the combo breaker and a poise break
 *  outrank them. */
export type StatusKind = 'burn' | 'slow' | 'freeze';
/** Seconds after a freeze thaws before another can take hold: no freeze locks. */
export const FREEZE_IMMUNITY = 2;
/** Seconds between two ticks of a burn. */
export const BURN_TICK = .5;

export type Outcome = 'launch' | 'hop' | 'crumple' | 'stagger' | 'spin' | 'wallBounce' | 'groundBounce' | 'knockdown' | 'dizzy';
/** The outcomes that take the body off the floor (and so open the chase). */
export const LAUNCHING: ReadonlySet<Outcome> = new Set(['launch', 'hop', 'crumple', 'wallBounce', 'groundBounce', 'knockdown']);
/** The outcomes that leave the body standing. */
type Standing = 'stagger' | 'spin' | 'dizzy';
/** How hard each throw sends the body up, m/s: under LAUNCH_GRAVITY a 6.6
 *  is 0.84 s in the air and 1.4 m at the top (a launch was 7.5 and 9: 0.96
 *  and 1.15 s), a 5 is 0.64 s and 0.8 m, a 2.2 a quarter of a second - a
 *  fall rather than a flight. A groundBounce drives a body standing on the
 *  floor into it, and it comes straight back up off it at GROUND_BOUNCE_LIFT
 *  (5.4). */
export const OUTCOME_LIFT: Record<Exclude<Outcome, Standing>, number> = {
  launch: 6.6, hop: 5, crumple: 2.2, wallBounce: 3.4, groundBounce: 5.4, knockdown: 3,
};
/** How long a body each outcome put on the floor stays down before it gets
 *  up (KNOCKDOWN_SECONDS is a true launch's). A launch was 0.62 s down and
 *  0.48 s getting up, on top of a second in the air; the short throws are
 *  meant to be carried on from, and their floor time is a beat. */
export const OUTCOME_DOWN: Record<Exclude<Outcome, Standing>, number> = {
  launch: .36, hop: .3, crumple: .34, wallBounce: .34, groundBounce: .34, knockdown: .8,
};
/** A dizzy outcome (combos.ts: Light x3 + Special) holds the body this long,
 *  a little longer than a guard break's GUARD_BREAK_STUN - long enough for one
 *  big follow-up - and a body dizzied inside DIZZY_GUARD is only hurt by the
 *  next one, so a string cannot keep somebody dazed. */
export const DIZZY_SECONDS = 1.3, DIZZY_GUARD = 6;
/** A wall bounce: the body comes back off the wall at this share of the speed
 *  it arrived with, lifted into reach, and the one who threw it may chase it
 *  again (CHASE_WINDOW from the bounce). */
export const WALL_BOUNCE_BACK = .42, WALL_BOUNCE_LIFT = 6;
/** A spin-out turns the body one whole turn over this long, and slides it
 *  off at this angle from the line of the blow (to the thrower's right). */
export const SPIN_SECONDS = .42, SPIN_ANGLE = 1.05;
/** A body staggered (or spun) this recently is only hurt by the next one,
 *  and held no longer than STAGGER_SPENT: a stagger opens one follow-up, not
 *  a loop. */
export const STAGGER_GUARD = 2.5, STAGGER_SPENT = .35;

/** Active frames: how long a melee hitbox stays open after its contact time.
 *
 *  A contact used to be tested on the single simulation tick it came due on,
 *  and then thrown away whether or not it found anybody. At 60 Hz that is one
 *  16.7 ms window, so an opponent a centimetre out of reach on that one frame
 *  took nothing at all while the blade swung visibly through them - and since
 *  a whiff is fully committed and cannot be cancelled, the punishment for
 *  being a centimetre short was the whole recovery. It is the single most
 *  common way this game reads as janky.
 *
 *  Every fighting game solves this the same way: the hitbox is open for a few
 *  frames rather than an instant. Five frames at 60 Hz is the usual range for
 *  a normal and is what this is. It does not make a move reach further - the
 *  reach test is unchanged - it only stops a connection being decided by
 *  which side of a tick boundary the two bodies happened to be on.
 *
 *  A heavier move holds its box open a little longer, which is also what the
 *  animation is doing: a 1.2-second swing is not over in a frame. */
export const ACTIVE_WINDOW = 5 / 60;
/** Round 3d (PACE): the heavies' box. It used to follow from their length -
 *  every melee heavy ran a second or more - and they are all under a second
 *  now, so the ones that had it carry it by name (`active`). */
export const HEAVY_ACTIVE = 7 / 60;
export function activeWindow(move: MoveDefinition): number {
  return move.active ?? (move.duration >= 1 ? HEAVY_ACTIVE : ACTIVE_WINDOW);
}

/** The four slots. The 36 fighters written inline here have no ultimate in their row: each one's is ULTIMATES' (below),
 *  set in when that table is built, so the move is written once. */
export const MOVES: Record<FighterId, Record<AttackSlot, MoveDefinition>> = ({
  akaito: AKAITO_MOVES,
  shijima: SHIJIMA_MOVES,
  chohan:CHOHAN_MOVES,aqrab:AQRAB_MOVES,tsubute:TSUBUTE_MOVES,yodaka:YODAKA_MOVES,ume:UME_MOVES,lanthorn:LANTHORN_MOVES,highsun:HIGHSUN_MOVES,torsion:TORSION_MOVES,kubiwa:KUBIWA_MOVES,onigawara:ONIGAWARA_MOVES,cardo:CARDO_MOVES,minase:MINASE_MOVES,aquilo:AQUILO_MOVES,'psyche':PSYCHE_MOVES,'ovid':OVID_MOVES,hawser:HAWSER_MOVES,rotfalke:ROTFALKE_MOVES,bonsho:BONSHO_MOVES,murex:MUREX_MOVES,kinu:KINU_MOVES,'madake':MADAKE_MOVES,akayuri:AKAYURI_MOVES,hagure:HAGURE_MOVES,hisame:HISAME_MOVES,svanhild:SVANHILD_MOVES,mizuhiki:MIZUHIKI_MOVES,'shibuichi':SHIBUICHI_MOVES,'rakucho':RAKUCHO_MOVES,irbis:IRBIS_MOVES,shidare:SHIDARE_MOVES,hinomoto:HINOMOTO_MOVES,amagoi:AMAGOI_MOVES,'shakudo':SHAKUDO_MOVES,hikui:HIKUI_MOVES,tokan:TOKAN_MOVES,strappado:STRAPPADO_MOVES,unari:UNARI_MOVES,barrow:BARROW_MOVES,sashigane:SASHIGANE_MOVES,gosu:GOSU_MOVES,kusushi:KUSUSHI_MOVES,
  hakushi:HAKUSHI_MOVES,
  suzuran:SUZURAN_MOVES,
  wataame:WATAAME_MOVES,
  bruin:BRUIN_MOVES,
  senko:SENKO_MOVES,
  buna:BUNA_MOVES,
  oyashio:OYASHIO_MOVES,
  adad:ADAD_MOVES,
  tempo:TEMPO_MOVES,
  tancho: TANCHO_MOVES,
  bellows: BELLOWS_MOVES,
  mikage: MIKAGE_MOVES,

  'full-beam': FULL_BEAM_MOVES,
  pyroclast: PYROCLAST_MOVES,
  ampere: AMPERE_MOVES,
  shanxiao: SHANXIAO_MOVES,
  kuzu: KUZU_MOVES,
  shakugo: SHAKUGO_MOVES,
  strix: STRIX_MOVES,
  'basilissa': BASILISSA_MOVES,
  sorayomi: SORAYOMI_MOVES,
  kenzo:{
    // Round 3e (VARIETY): precise, with reach. The longest light reach on the
    // roster's middle clock; a string that drives them back to a wall.
    light:{name:'Fang Crossing',duration:.47,contacts:[.18],damage:20,range:2.6,radius:.5,stamina:9,cooldown:.45,stun:.25,knockback:3,lunge:4.5,style:'melee'},
    // An iai draw: a run-up if they are on top of him, then a dash straight
    // through them that ends past them, cutting as it goes. Round 3e: one of
    // the four heavies that still launch - they fly back the way he came.
    heavy:{name:'Mirage Draw',duration:.88,contacts:[.42],damage:58,range:2.8,radius:.7,stamina:24,cooldown:1.15,active:HEAVY_ACTIVE,stun:.7,knockback:8,lunge:7,style:'melee',chargeIn:2.4,dashThrough:true,outcome:'launch'},
    // Round 3e: the flying slash carries them off along the floor and throws
    // them back off a wall.
    special:{name:'thousand mile eagle',duration:1.5,contacts:[.72],damage:126,range:35,radius:1.35,stamina:30,cooldown:4.5,stun:1.1,knockback:11,speed:28,style:'projectile',outcome:'wallBounce'},
  },
  koko:{
    // Round 3e (VARIETY): heavy and punishing. Iron Spirit's fist lands a
    // beat later than the roster's and harder; the string leaves them
    // reeling for the GAN.
    light:{name:'Straight Punch',duration:.5,contacts:[.19],damage:23,range:2.2,radius:.5,stamina:10,cooldown:.48,stun:.28,knockback:3.5,lunge:2,style:'melee'},
    // Iron Spirit's finger extends: a projectile, so KoKo has a blow that
    // reaches across the room. Every fighter carries one long-range move now.
    // Round 3e: it pins them where they stand, reeling - the GAN or a string
    // is on them before they recover.
    heavy:{name:'Needle Finger',duration:.8,contacts:[.34],damage:62,range:9,radius:.5,stamina:23,cooldown:1.1,stun:.85,knockback:2.5,speed:40,style:'projectile',outcome:'stagger'},
    // Round 3d (PACE): twenty-two, at 0.9 with every special.
    // Twenty-five a tick, not eighteen. Every contact of a string is scaled
    // by damageScale below, so a barrage that is authored as eight times its
    // per-tick figure never realises it: at eighteen the eight ticks landed
    // 99 against the 135 to 140 every single-contact special in the roster
    // takes off a standing opponent. Measured cold (tests/fullRoster.test.ts)
    // the eight ticks now realise 138.
    // Round 3e (VARIETY): twenty-four a tick, the heavy hitter's barrage, and
    // the last GAN blows them back along the floor into a wall bounce.
    special:{name:'GAN GAN Barrage',duration:2.34,contacts:[.6,.77,.94,1.11,1.28,1.45,1.62,1.79],damage:24,range:3,radius:.7,stamina:32,cooldown:4.5,stun:.2,finisherStun:1.1,knockback:0,finisherKnockback:12,lunge:3,style:'melee',outcome:'wallBounce'},
  },
  nigo:{
    // Round 3e (VARIETY): a big blade with a big swing - a beat slower and
    // harder than the roster's middle; the string drives them back.
    light:{name:'Haizan Cut',duration:.48,contacts:[.18],damage:21,range:2.5,radius:.6,stamina:9,cooldown:.46,stun:.24,knockback:3,lunge:2.5,style:'melee'},
    // Round 3e: the dash cut pops them off their feet: the light that
    // follows is the chase, and the juggle is on.
    heavy:{name:'Ashstep Strike',duration:.84,contacts:[.38],damage:56,range:2.6,radius:.7,stamina:23,cooldown:1.15,active:HEAVY_ACTIVE,stun:.7,knockback:2,lunge:9,style:'melee',outcome:'hop',lift:5.4},
    special:{name:'Scorched Earth',duration:1.5,contacts:[.7],damage:126,range:35,radius:1.3,stamina:30,cooldown:4.5,stun:1.1,knockback:10,speed:30,style:'projectile',outcome:'launch'},
  },
  shirokane:{
    // Round 3e (VARIETY): technical and quick - the kunai a hair ahead of the
    // roster, and a string that ends with them reeling for the Sickle Bolt.
    light:{name:'Scrap Kunai',duration:.4,contacts:[.14],damage:17,range:1.8,radius:.35,stamina:8,cooldown:.39,stun:.22,knockback:3,lunge:3,style:'melee'},
    // Round 3e: run through, they fold round the blade and drop where they
    // stood - up again in a beat, with him still on top of them.
    heavy:{name:'Sickle Bolt',duration:.92,contacts:[.44],damage:55,range:1.8,radius:.6,stamina:23,cooldown:1.1,active:HEAVY_ACTIVE,stun:.5,knockback:1.5,lunge:6,style:'melee',chargeIn:2,outcome:'crumple'},
    // Held by the current: a stagger that lasts (the round-3b rocked victim).
    special:{name:'Static Scarecrow',duration:1.45,contacts:[.62],damage:122,range:26,radius:.8,stamina:30,cooldown:4.5,stun:1.4,knockback:5,speed:12,style:'projectile',outcome:'stagger'},
  },
  shiden:{
    // Round 3e (VARIETY): quick and exact - the sword a hair ahead of the
    // roster; a string that ends in a heel drop into the floor.
    light:{name:'Habakiri Cut',duration:.42,contacts:[.15],damage:18,range:2.2,radius:.42,stamina:9,cooldown:.41,stun:.23,knockback:3,lunge:2.5,style:'melee'},
    // Round 3e: the lightning locks them up where they stand.
    heavy:{name:'Shrike Bolt',duration:.92,contacts:[.44],damage:56,range:1.9,radius:.6,stamina:23,cooldown:1.15,active:HEAVY_ACTIVE,stun:.8,knockback:3,lunge:6,style:'melee',chargeIn:2,outcome:'stagger'},
    // Round 3e: the last burn drops them where they stand.
    special:{name:'Black Pyre',duration:2.3,contacts:[.5,.85,1.2,1.55,1.9],damage:27,range:22,radius:2.4,stamina:30,cooldown:4.7,stun:.15,knockback:0,style:'field',outcome:'crumple'},
  },
  kosho:{
    // Round 3e (VARIETY): quick and light. The quickest feet in the roster
    // bar Setsu's claws, for less; the string kicks them up and keeps them
    // there.
    light:{name:'Amuse-Bouche',duration:.36,contacts:[.13],damage:16,range:1.3,radius:.36,stamina:7,cooldown:.36,stun:.22,knockback:2.5,lunge:3.5,style:'melee'},
    // Round 3e: the heel drop - driven into the floor, up off it into a juggle.
    heavy:{name:'Hachoir',duration:.78,contacts:[.34],damage:52,range:1.7,radius:.65,stamina:21,cooldown:1,active:HEAVY_ACTIVE,stun:.6,knockback:2,lunge:2.5,style:'melee',outcome:'groundBounce'},
    special:{name:'Brasier: Coup de Feu',duration:1.32,contacts:[.58],damage:118,range:16,radius:1.15,stamina:30,cooldown:4.3,stun:1.1,knockback:10,speed:34,aimOnRelease:true,guardBreak:true,style:'projectile',outcome:'launch'},
  },
  ouga:{
    light:{name:'Crown Straight',duration:.45,contacts:[.16],damage:20,range:2.3,radius:.5,stamina:9,cooldown:.43,stun:.24,knockback:3,lunge:3,style:'melee'},
    // Round 3e: one of the four heavies that still launch - an explosion.
    heavy:{name:'Haou-Dan',duration:.84,contacts:[.37],damage:56,range:24,radius:.8,stamina:24,cooldown:1.25,stun:.5,knockback:8,speed:24,style:'projectile',outcome:'launch'},
    // Round 3e: the beam drives them back along the floor, off a wall if one
    // is behind them.
    special:{name:'Shikou-Ha',duration:2,contacts:[.8],damage:128,range:35,radius:.8,stamina:30,cooldown:4.5,stun:1.2,knockback:10,style:'beam',outcome:'wallBounce'},
  },
  taisei: {
    // Was 0.48 long, landing at 0.14, for 36, off a 0.48 cooldown - the
    // fastest, the earliest, the hardest and the shortest-cooling light in the
    // game, all four at once. 75 damage a second against 49 to 60 for everyone
    // else, and scripts/probe_exchange.mts measured him taking 257 off a
    // standing opponent where the roster takes 103 to 172. The roster was
    // re-timed onto his cadence once; this brings him onto theirs. Still the
    // joint quickest jab in the game, no longer a different game.
    light: { name: "Stoneborn Fist", duration: .42, contacts: [.15], damage: 18, range: 1.2, radius: 0.3, stamina: 6, cooldown: .42, stun: 0.19, knockback: 2, lunge: 5, style: 'melee' },
    heavy: { name: 'Cloudstep Strike', duration: .84, contacts: [.448], damage: 54, range: 1.4, radius: 0.55, stamina: 23, cooldown: 1.2, stun: 0.7, knockback: 10, lunge: 12, lungeDelay: .298, style: 'melee', active: HEAVY_ACTIVE,
      teleport: { vanish: .165, appear: .298, reach: 10, behind: 1.15, miss: 2.5 }, outcome: 'launch' },
    // Round 3e: the beam drives them back along the floor, off a wall if one
    // is behind them.
    special: { name: 'Sunpalm Cannon', duration: 1.75, contacts: [.75], damage: 122, range: 38, radius: 1.05, stamina: 30, cooldown: 4.2, stun: 1.12, knockback: 10, style: 'beam', outcome: 'wallBounce' },
  },
  gummy: {
    // Round 3e (VARIETY): the rubber jab stays quick; the Bazooka is the
    // heavy and punishing half of him - it winds up longer and lands harder
    // than anyone's but Gaunt'. The string carries a body back and off the
    // wall. (Round 4b: the special is a barrage now, the SUNSET BARRAGE.)
    light: {name:'Snapback Jab', duration:.42, contacts:[.15], damage:17, range:2.5, radius:.4, stamina:8, cooldown:.4, stun:.2, knockback:3, style:'melee'},
    // Round 3e: both palms - blown back along the floor, and a wall behind
    // them throws them back into reach.
    heavy: {name:'Rogue Wave', duration:.9, contacts:[.42], damage:68, range:3.6, radius:.8, stamina:24, cooldown:1.2, stun:.7, knockback:13, style:'melee', outcome:'wallBounce'},
    special: {name:'Sunset Barrage', duration:1.62, contacts:[.5,.59,.68,.77,.86,.95,1.04,1.13,1.25], damage:19, finisherDamage:60, range:16, radius:1, stamina:30, cooldown:4.7, stun:.22, finisherStun:1, knockback:0, finisherKnockback:11, style:'beam', track:.6, outcome:'wallBounce'},
  },
  konta: {
    // Round 3d (PACE): the baked barrage at 0.75 of its clock (0.82 s, the
    // blows at 0.16, 0.33 and 0.56), each blow at its share of the move.
    light: { name: 'Foxpack Barrage', duration: .615, contacts: [.12, .2475, .42], damage: 10, range: 2.6, radius: 0.7, stamina: 9, cooldown: .64, stun: 0.15, knockback: 3, lunge: 1.8, style: 'melee' },
    // Round 3d (PACE): the Blender take at 0.53 of its round-3 clock (1.65 s,
    // the blow at 0.94), the palm meeting them at 0.5 - the clip is played
    // straight across the move, so the blow keeps its share of it. The sphere
    // forms in place for a quarter of a second and the approach starts there
    // (it was 0.70): it keeps the quarter second it always had to cross the
    // gap in, so the charge-in still lands from 4.3 m. Started at the take's
    // own chamber (0.38) it reached 2.5 m.
    // Round 3e (VARIETY): one of the four heavies that still launch - the
    // sphere sends them spinning up and away, and the Galewheel, out
    // quickly enough, catches them there.
    heavy: { name: 'Senpugan', duration: .88, contacts: [.5], damage: 58, range: 3.3, radius: 1, stamina: 24, cooldown: 1.2, stun: 0.38, knockback: 10, lunge: 6, lungeDelay: .245, style: 'melee', chargeIn: 2, active: HEAVY_ACTIVE, outcome: 'launch', palmHold: true, lockAim: true },
    special: { name: 'Wind Art: Galewheel', duration: 1.35, contacts: [0.5], damage: 125, range: 34, radius: 1.5, stamina: 28, cooldown: 5.5, stun: 0.42, knockback: 9, speed: 24, style: 'projectile' },
  },
  // Round 16. Timings copy the roster's cadence (lights ~0.55 s with the blow
  // at ~40%, heavies ~1.2 s, specials ~2.6 s, ultimates ~4.5-5 s); the
  // contact of each is aligned to its clip by contactFrames.json at build.
  kagari:{
    // Round 3e (VARIETY): the roster's middle, a flame fighter who keeps his
    // distance with the TAIMATSU; the string ends in a launch.
    light:{name:'Hinoko',duration:.44,contacts:[.16],damage:19,range:2.2,radius:.5,stamina:9,cooldown:.42,stun:.24,knockback:3,lunge:3,style:'melee'},
    heavy:{name:'Yuragi',duration:.9,contacts:[.38],damage:55,range:8,radius:1.2,stamina:23,cooldown:1.3,stun:.5,knockback:2.5,speed:34,aimOnRelease:true,style:'projectile',outcome:'crumple'},
    // TAIMATSU: the column of flame thrown from the fist.
    // Round 4b (FMOVES): a fist of fire the size of a man punched out at them -
    // its own take, the right thrown straight out and held, let go at 0.6 s
    // (0.72), aimed as it leaves (aimOnRelease), wider (1.3) and faster (36).
    special:{name:'Taimatsu',duration:1.36,contacts:[.6],damage:124,range:20,radius:1.3,stamina:30,cooldown:4.5,stun:1.1,knockback:10,speed:36,aimOnRelease:true,guardBreak:true,style:'projectile',outcome:'launch'},
  },
  ward:{
    // Round 3e (VARIETY): precise, with reach - LANCET's length on the
    // roster's middle clock, and a string that lifts them (Tact) and keeps
    // them up.
    light:{name:'Lancet Slash',duration:.46,contacts:[.17],damage:19,range:2.7,radius:.5,stamina:9,cooldown:.44,stun:.25,knockback:3,lunge:4.5,style:'melee'},
    // Round 3e: the thrust twists them round and sends them reeling aside.
    heavy:{name:'Stat Shot',duration:.84,contacts:[.38],damage:56,range:2.8,radius:.6,stamina:23,cooldown:1.1,active:HEAVY_ACTIVE,stun:.65,knockback:4,lunge:8,style:'melee',outcome:'spin'},
    // Cautery Blade: a hand through the guard and into the chest. Round 3e: it
    // drops them where they stand.
    special:{name:'Cautery Blade',duration:1.4,contacts:[.62],damage:124,range:2.4,radius:.8,stamina:30,cooldown:4.5,stun:.5,knockback:1.5,close:4,guardBreak:true,style:'melee',outcome:'crumple'},
  },
  kuon:{
    // Round 3e (VARIETY): control. Blue drags them in, the string's Reversal:
    // Red blows them back off the wall, Purple erases them into the air.
    light:{name:'Hex Strike',duration:.44,contacts:[.16],damage:19,range:2.2,radius:.5,stamina:9,cooldown:.43,stun:.24,knockback:3,lunge:3,style:'melee'},
    // Hex Art Gravity, thrown. Blue attracts: round 3b turns its
    // knockback round (negative is toward where the blow came from, and
    // never a launch), so it drags the victim about 2.5 m along the floor in
    // toward Kuon, into reach of what follows, instead of blowing them away.
    heavy:{name:'Gravity',duration:.86,contacts:[.38],damage:53,range:14,radius:.8,stamina:24,cooldown:1.25,stun:.5,knockback:-18,speed:26,style:'projectile'},
    special:{name:'Singularity',duration:1.7,contacts:[.8],damage:126,range:38,radius:1.1,stamina:30,cooldown:4.5,stun:1.15,knockback:10,guardBreak:true,style:'beam',outcome:'launch'},
  },
  oro:{
    // Round 3e (VARIETY): HUSH is the quicker spirit - LORD ORO's fist a hair
    // ahead of KoKo's and lighter, and a string that spins them round.
    light:{name:'Gilded Punch',duration:.42,contacts:[.15],damage:18,range:2.2,radius:.5,stamina:9,cooldown:.41,stun:.23,knockback:3,lunge:2,style:'melee'},
    // A fan of knives, thrown. Round 3e: they pin the body where it stands,
    // reeling - LORD ORO is on them before it can move.
    heavy:{name:'Clock-Hand Knives',duration:.72,contacts:[.28],damage:52,range:12,radius:.5,stamina:22,cooldown:1,stun:.8,knockback:2,speed:32,style:'projectile',outcome:'stagger'},
    // HUSH's barrage, mirrored on KoKo's GAN - a tick lighter, as
    // LORD ORO's fists are - and blown back off a wall at the end the same way.
    special:{name:'NOROMA NOROMA Barrage',duration:2.34,contacts:[.6,.77,.94,1.11,1.28,1.45,1.62,1.79],damage:22,range:3,radius:.7,stamina:32,cooldown:4.5,stun:.2,finisherStun:1.1,knockback:0,finisherKnockback:12,lunge:3,style:'melee',outcome:'wallBounce'},
  },
  gaunt:{
    // A sword taller than he is: slower than the roster's lights, and it hits harder.
    // Round 3e (VARIETY): heavy and punishing - the roster's slowest and
    // hardest light, a Cleave that spikes them off the floor into a juggle,
    // and a string that ends the same way.
    light:{name:'Gravedigger Slash',duration:.58,contacts:[.24],damage:27,range:2.9,radius:.8,stamina:11,cooldown:.56,stun:.32,knockback:4.5,lunge:3,style:'melee'},
    heavy:{name:'Butcher Cleave',duration:1.02,contacts:[.5],damage:72,range:13,radius:1.3,stamina:26,cooldown:1.3,stun:.75,knockback:3,speed:30,aimOnRelease:true,style:'projectile',outcome:'groundBounce'},
    special:{name:'Scrap Cannon Arm',duration:1.36,contacts:[.55],damage:138,range:20,radius:1.2,stamina:30,cooldown:4.7,stun:1.1,knockback:11,speed:46,aimOnRelease:true,guardBreak:true,style:'projectile',outcome:'launch'},
  },
  setsu:{
    // Fast and light: the quickest normals in the roster.
    // Round 3e (VARIETY): quick and light - the claw out at 0.12 s for 16,
    // the quickest heavy and special, and a string that juggles. His
    // lightning paralyses rather than throws: Thunderbolt and Ikazuchi leave
    // the body standing, locked up, for him to be on it again.
    light:{name:'Snow Claw',duration:.34,contacts:[.12],damage:16,range:2.0,radius:.45,stamina:7,cooldown:.34,stun:.2,knockback:2.5,lunge:5,style:'melee'},
    heavy:{name:'Sekkou',duration:.66,contacts:[.26],damage:51,range:2.2,radius:.6,stamina:20,cooldown:.95,stun:.8,knockback:2,lunge:7,style:'melee',outcome:'stagger'},
    // Ikazuchi: the lightning let go of the hands.
    special:{name:'Ikazuchi',duration:1.2,contacts:[.5],damage:116,range:14,radius:.7,stamina:30,cooldown:4.2,stun:1.05,knockback:3,speed:45,style:'projectile',outcome:'stagger'},
  },
  // The shop's fighters (economy/fighters.ts). Bought, not better: each is
  // inside the roster's pace (the round 3d/3e figures above), heavy and
  // punishing like Gaunt - a club and a bisento as heavy as his sword - or
  // precise like Ward, with the Gryphon's reach.
  gorai:{
    // The mast-breaker: as slow and as hard as Gaunt' sword, and a string that slams
    // them into the floor.
    light:{name:'Mast Breaker',duration:.6,contacts:[.24],damage:27,range:3,radius:.85,stamina:11,cooldown:.58,stun:.33,knockback:4.5,lunge:3,style:'melee'},
    // The leap and the overhead smash: they bounce off the floor.
    heavy:{name:'Hull Crusher',duration:1.02,contacts:[.5],damage:72,range:3.2,radius:1,stamina:26,cooldown:1.3,active:HEAVY_ACTIVE,stun:.75,knockback:3,lunge:5,style:'melee',outcome:'groundBounce'},
    // Grog Gale: a swig from the gourd, and the swing throws the wind it raises -
    // it turns them round where it catches them.
    special:{name:'Grog Gale',duration:1.55,contacts:[.74],damage:136,range:16,radius:1.1,stamina:30,cooldown:4.7,stun:1.1,knockback:11,speed:26,guardBreak:true,style:'projectile',outcome:'spin'},
  },
  haldor:{
    // The bisento: Gorai's weight, a reach just short of the two swordsmen's
    // (Kenzo's and Ward's are the roster's longest), and a string that drives
    // them back to the wall.
    light:{name:'Crescent Reap',duration:.6,contacts:[.24],damage:27,range:2.55,radius:.85,stamina:11,cooldown:.58,stun:.32,knockback:4.5,lunge:3.5,style:'melee'},
    heavy:{name:'Prow Splitter',duration:1.02,contacts:[.5],damage:71,range:3.3,radius:.95,stamina:26,cooldown:1.3,active:HEAVY_ACTIVE,stun:.75,knockback:6,lunge:5,style:'melee',outcome:'wallBounce'},
    // Faultline Fist: the quake driven through the air ahead of his fist. It goes
    // through a guard, and throws them into whatever is behind them.
    special:{name:'Faultline Fist',duration:1.6,contacts:[.78],damage:132,range:14,radius:1.4,stamina:30,cooldown:4.7,stun:1.2,knockback:13,speed:34,guardBreak:true,style:'projectile',outcome:'wallBounce'},
  },
  sorrel:{
    // Precise: the Gryphon on Ward's clock, a little short of his reach.
    light:{name:'Wake Cutter',duration:.46,contacts:[.17],damage:19,range:2.55,radius:.55,stamina:9,cooldown:.44,stun:.25,knockback:3,lunge:4.5,style:'melee'},
    heavy:{name:'Redline Thrust',duration:.86,contacts:[.38],damage:57,range:2.9,radius:.6,stamina:23,cooldown:1.1,active:HEAVY_ACTIVE,stun:.65,knockback:5,lunge:8,style:'melee',outcome:'stagger'},
    // Crimson Command: not a blow but his will, out round him - whoever it
    // reaches buckles where they stand, and a guard does not keep it out.
    special:{name:"Crimson Command",duration:1.4,contacts:[.6],damage:112,range:1.2,radius:4.2,stamina:30,cooldown:4.7,stun:1.4,knockback:2,guardBreak:true,style:'melee',outcome:'crumple'},
  },
  dorado:{
    // Kagari, his saber, on the Gryphon's clock: the man who taught Sorrel cuts
    // as precisely, and a little harder.
    light:{name:'Gilded Cut',duration:.48,contacts:[.17],damage:20,range:2.55,radius:.6,stamina:9,cooldown:.46,stun:.26,knockback:3.2,lunge:4.5,style:'melee'},
    // The lunge, and the rising cut out of it that pops them off their feet.
    heavy:{name:'Crown Lunge',duration:.98,contacts:[.46],damage:60,range:3,radius:.7,stamina:24,cooldown:1.2,active:HEAVY_ACTIVE,stun:.7,knockback:4,lunge:8,style:'melee',outcome:'hop'},
    // Sovereign Shot: the flintlock at his belt drawn and fired, the ball
    // wrapped in his Crimson Command. It goes through a guard, and they reel.
    special:{name:"Sovereign Shot",duration:1.3,contacts:[.6],damage:122,range:22,radius:.7,stamina:30,cooldown:4.4,stun:1.2,knockback:6,speed:48,guardBreak:true,style:'projectile',outcome:'stagger'},
  },
  shiun:{
    light:{name:'Measured Cut',duration:.44,contacts:[.15],damage:18,range:2.3,radius:.7,stamina:8,cooldown:.42,stun:.24,knockback:4.5,lunge:4,style:'melee'},
    heavy:{name:'False Encore',duration:.9,contacts:[.5],damage:58,range:3,radius:.8,stamina:24,cooldown:1.2,active:HEAVY_ACTIVE,stun:.75,knockback:3,lunge:12,lungeDelay:.3,style:'melee',
      teleport:{vanish:.1,appear:.3,reach:8,behind:1.15,miss:2.5},outcome:'crumple'},
    // Hymn 12: Stained-Glass Lances: the wings leave his back as a volley of
    // light, through a guard, and turn them round where it lands.
    special:{name:'Hymn 12: Stained-Glass Lances',duration:1.7,contacts:[.7],damage:126,range:24,radius:1,stamina:30,cooldown:4.6,stun:1.1,knockback:8,speed:38,guardBreak:true,style:'projectile',outcome:'spin'},
  },
  magatsu:{
    // Flaying Cut: the hand that slashes, and the cut goes on past it.
    light:{name:'Flaying Cut',duration:.46,contacts:[.16],damage:19,range:2.4,radius:.7,stamina:9,cooldown:.44,stun:.25,knockback:3.5,lunge:4.5,style:'melee'},
    // Calamity Maw, a cut that measures what it cuts: it throws them back into the wall.
    heavy:{name:'Calamity Maw',duration:.9,contacts:[.44],damage:61,range:2.8,radius:.9,stamina:24,cooldown:1.2,active:HEAVY_ACTIVE,stun:.75,knockback:6,lunge:7,style:'melee',outcome:'wallBounce'},
    // Rend: Thousand Cuts, the slashes thrown with a sweep of the hand: they go
    // through a guard, and leave them reeling.
    special:{name:'Rend: Thousand Cuts',duration:1.5,contacts:[.68],damage:128,range:20,radius:1.2,stamina:30,cooldown:4.5,stun:1.1,knockback:5,speed:46,guardBreak:true,style:'projectile',outcome:'stagger'},
  },
  vesper:{
    // Quill Thrust: a fencer's lunge, the quickest of the swords' lights and the narrowest, and long.
    light:{name:'Quill Thrust',duration:.44,contacts:[.16],damage:18,range:2.6,radius:.5,stamina:9,cooldown:.42,stun:.24,knockback:3,lunge:5,style:'melee'},
    // Raven's Drop: the overhead cut, driven down through them into the floor and up off it into a juggle.
    heavy:{name:"Raven's Drop",duration:.88,contacts:[.42],damage:60,range:2.8,radius:.75,stamina:24,cooldown:1.15,active:HEAVY_ACTIVE,stun:.7,knockback:3,lunge:7,style:'melee',outcome:'groundBounce'},
    special:{name:'Pale Lance',duration:1.2,contacts:[.5],damage:118,range:24,radius:.7,stamina:30,cooldown:4.4,stun:1.1,knockback:7,speed:40,style:'projectile',outcome:'wallBounce'},
  },
  imago:{
    // Swarm Claw: the King's hand, quicker than any light but Setsu's.
    light:{name:'Swarm Claw',duration:.42,contacts:[.15],damage:18,range:2.2,radius:.75,stamina:8,cooldown:.4,stun:.24,knockback:3,lunge:5.5,style:'melee'},
    // Stinger Lash: the roundhouse, and the tail comes round with it - into the wall.
    heavy:{name:'Stinger Lash',duration:.86,contacts:[.4],damage:60,range:3,radius:1,stamina:24,cooldown:1.15,active:HEAVY_ACTIVE,stun:.7,knockback:6,lunge:6,style:'melee',outcome:'wallBounce'},
    // Hive Burst (4 October, combos.ts: every fighter at least one attack at range): the arm thrust out and an
    // explosive blast of aura - his, after the Rose, from Youpi's (Salvage Wilds, chapter 302; the wiki marks the
    // name unofficial). (Stinger Storm, the special it was, is his Jump + Special now: combosShop.ts.)
    special:{name:'Hive Burst',duration:1.3,contacts:[.56],damage:120,range:22,radius:1.2,stamina:30,cooldown:4.6,stun:1.1,knockback:10,speed:30,style:'projectile',outcome:'wallBounce'},
  },
  'wuming':{
    // Lightless Strike: the rush's first blow, Taisei's speed in another's hands.
    light:{name:'Lightless Strike',duration:.44,contacts:[.16],damage:18,range:2.2,radius:.55,stamina:8,cooldown:.42,stun:.24,knockback:3,lunge:5,style:'melee'},
    // He is laid out as Taisei is (and as the home-screen agent's move cards draw him): the fist, Instant
    // Transmission for the heavy, the Sunpalm Cannon for the special.
    // The Petalfall Blade: two fingers to his forehead and he is gone - Taisei's Cloudstep, which
    // he took with the body - and back behind them in the air, the blade of ki out of his hand and down through
    // them, and they fold. A guard held turns to meet him and keeps it out, as it does Taisei's. Nobody in reach, he
    // blinks ahead and cuts the air there. The vanish and the return are where the clip, paced, has the sign
    // made and the leap's arm up; the seam between the two clips it is joined from falls while he is gone.
    heavy:{name:'Petalfall Blade',duration:.9,contacts:[.5],damage:56,range:2.2,radius:.7,stamina:23,cooldown:1.2,active:HEAVY_ACTIVE,stun:.7,knockback:6,lunge:12,lungeDelay:.3,style:'melee',
      teleport:{vanish:.1,appear:.3,reach:8,behind:1.15,miss:2.5},outcome:'crumple'},
    // The Lightless Cannon: the hand drawn back to his hip, the ki gathered there, and thrust out as the beam -
    // back along the floor and off a wall.
    special:{name:'Lightless Cannon',duration:1.7,contacts:[.78],damage:120,range:34,radius:1,stamina:30,cooldown:4.4,stun:1.1,knockback:9,style:'beam',outcome:'wallBounce'},
  },
  // Jirenga, laid out as the home-screen agent's move cards draw him.
  jirenga:{
    // Bedrock Jab: the rush's first blow, a one-two - short and straight, and heavier than it looks.
    light:{name:'Bedrock Jab',duration:.46,contacts:[.17],damage:19,range:2.3,radius:.55,stamina:9,cooldown:.44,stun:.25,knockback:3.5,lunge:4.5,style:'melee'},
    heavy:{name:'Uprooting Fist',duration:.9,contacts:[.44],damage:58,range:2.4,radius:.75,stamina:24,cooldown:1.2,active:HEAVY_ACTIVE,stun:.7,knockback:3,lunge:7,style:'melee',outcome:'hop',lift:7},
    // Vermilion Seal: the right palm drawn back to his shoulder behind the left, and driven out - one red sphere of
    // his ki off it, into the wall.
    special:{name:'Vermilion Seal',duration:1.6,contacts:[.74],damage:126,range:26,radius:1.15,stamina:30,cooldown:4.6,stun:1.15,knockback:11,speed:26,style:'projectile',outcome:'wallBounce'},
  },
  // Emperor Jinlin, the same.
  'jinlin':{
    // Pearl Needle: his right hand jabbed out finger first and the beam off the fingertip, accent - a melee
    // blow, as every light is, drawn as the beam (EmperorEffects).
    light:{name:'Pearl Needle',duration:.42,contacts:[.15],damage:17,range:2.4,radius:.5,stamina:8,cooldown:.4,stun:.24,knockback:3,lunge:5,style:'melee'},
    // Whirlpool Tail: the tail swung round him through a whole turn - it lands from further out than a fist - and
    // throws them into the wall. (Spun where they stood, the horde never let him go: he died in eight of the Rift's
    // twelve balance seeds until his blows put them down or away.)
    heavy:{name:'Whirlpool Tail',duration:.9,contacts:[.46],damage:56,range:2.9,radius:1,stamina:24,cooldown:1.2,active:HEAVY_ACTIVE,stun:.7,knockback:7,lunge:5,style:'melee',outcome:'wallBounce'},
    // Pearl Rain: both hands raised, thrust out and held there, firing - pinpoint beams, too quick to see
    // between them (one shot, drawn as the volley by EmperorEffects), and they fold.
    special:{name:'Pearl Rain',duration:1.6,contacts:[.72],damage:118,range:26,radius:.6,stamina:30,cooldown:4.4,stun:1.1,knockback:6,speed:60,style:'projectile',outcome:'crumple'},
  },
  // Gohaku, laid out as the home-screen agent's move cards draw him.
  'gohaku':{
    // Long-Arm Fist: a straight punch with his ki behind it - the card's ki-charged fist.
    light:{name:'Long-Arm Fist',duration:.45,contacts:[.16],damage:19,range:2.3,radius:.55,stamina:9,cooldown:.43,stun:.25,knockback:3,lunge:5,style:'melee'},
    // Rising Kick: in at them and the turning kick up through them, off their feet.
    heavy:{name:'Rising Kick',duration:.9,contacts:[.46],damage:57,range:2.6,radius:.8,stamina:24,cooldown:1.2,active:HEAVY_ACTIVE,stun:.7,knockback:4,lunge:7,style:'melee',outcome:'hop',lift:5},
    // Star-Shifting Beam: both hands raised over his brow, the ki gathered there, and thrust out as the beam.
    special:{name:'Star-Shifting Beam',duration:1.8,contacts:[.78],damage:124,range:34,radius:.95,stamina:30,cooldown:4.4,stun:1.1,knockback:9,style:'beam',outcome:'wallBounce'},
  },
  // Ippon, laid out as the home-screen agent's move cards draw him.
  ippon:{
    // Clock-In Punch: a straight right, low and lunging. It is only a plain punch.
    light:{name:'Clock-In Punch',duration:.46,contacts:[.17],damage:19,range:2.3,radius:.55,stamina:9,cooldown:.44,stun:.25,knockback:3.5,lunge:5,style:'melee'},
    // Dust Allergy (4 October, combos.ts: every fighter at least one attack at range): the head back, and a sneeze
    // that blows a planet's sky away: a cone of wind that blows them into the wall.
    heavy:{name:'Dust Allergy',duration:1,contacts:[.5],damage:60,range:16,radius:1.6,stamina:24,cooldown:1.25,stun:.8,knockback:12,style:'beam',outcome:'wallBounce'},
    // Double Shift: both fists, again and again where he stands, faster than they can be seen (the
    // effects draw the fists the eye misses), and the last one sends them into the wall.
    special:{name:'Double Shift',duration:1.9,contacts:[.52,.64,.76,.88,1,1.12,1.24,1.4],damage:16,range:2.6,radius:.8,stamina:30,cooldown:4.5,stun:.2,finisherStun:1.1,knockback:0,finisherKnockback:11,lunge:3,style:'melee',outcome:'wallBounce'},
  },
  // Sekka, laid out as the home-screen agent's move cards draw him: Gravedigger in bare hands.
  sekka:{
    // Air Type: a straight thrown at the air in front of him, and the air carries it on into them - a melee blow, as
    // every light is, drawn as the shock ahead of the fist (EmperorEffects).
    light:{name:'Straight Punch',duration:.44,contacts:[.16],damage:18,range:2.4,radius:.55,stamina:8,cooldown:.42,stun:.24,knockback:3.5,lunge:5,style:'melee'},
    heavy:{name:'Avalanche',duration:1,contacts:[.3,.48,.7],damage:19,finisherDamage:20,range:2.5,radius:.8,stamina:24,cooldown:1.2,active:HEAVY_ACTIVE,stun:.4,finisherStun:.7,knockback:.6,finisherKnockback:7,lunge:6,style:'melee',outcome:'wallBounce'},
    // Shatter Art: Frost Gale (4 October, combos.ts: every fighter at least one attack at range): a straight
    // thrown at the empty air, and the shock flies on into them - his one true projectile (Black Snow; the wiki). The
    // light that wore the name is a plain straight now. The Compass Needle's snowflake opens under his stun (Final
    // Form: Blue Silver Chaotic Afterglow, combosShop.ts).
    special:{name:'Shatter Art: Frost Gale',duration:1.25,contacts:[.52],damage:112,range:18,radius:.9,stamina:30,cooldown:4.4,stun:1.1,knockback:9,speed:44,style:'projectile',outcome:'wallBounce'},
  },
  // Tobari, laid out as the home-screen agent's move cards draw him.
  tobari:{
    // Kunai Slash: a kunai drawn across them (the cut is EmperorEffects').
    light:{name:'Kunai Slash',duration:.42,contacts:[.15],damage:18,range:2.4,radius:.5,stamina:8,cooldown:.4,stun:.23,knockback:3,lunge:5,style:'melee'},
    // Murder of Crows: the one-handed seal, and he is gone in a burst of crows - back behind them, and the kick that throws
    // them into the wall. As Wuming's Cloudstep is (MoveDefinition.teleport): a guard held turns to meet
    // him; nobody in reach, he goes on ahead.
    heavy:{name:'Murder of Crows',duration:.9,contacts:[.5],damage:56,range:2.3,radius:.75,stamina:23,cooldown:1.2,active:HEAVY_ACTIVE,stun:.7,knockback:7,lunge:12,lungeDelay:.3,style:'melee',
      teleport:{vanish:.12,appear:.32,reach:8,behind:1.2,miss:2.5},outcome:'wallBounce'},
    // Black Pyre: his hand to the bleeding eye, and the black flames catch on whoever he is looking at and burn there,
    // as Shiden's do: a field on the target, four burns.
    special:{name:'Black Pyre',duration:2.2,contacts:[.6,.95,1.3,1.65],damage:30,range:22,radius:2.2,stamina:30,cooldown:4.7,stun:.15,knockback:0,style:'field',outcome:'crumple'},
  },
  // The sixth wave, laid out as the home-screen agent's move cards draw them.
  akagane:{
    // War Fan Sweep: the war fan swept across them (drawn as the swing, EmperorEffects).
    light:{name:'War Fan Sweep',duration:.46,contacts:[.17],damage:19,range:2.5,radius:.65,stamina:8,cooldown:.42,stun:.24,knockback:3.5,lunge:5,style:'melee'},
    // Rising Kick: taijutsu - the turning kick up through them, off their feet.
    heavy:{name:'Rising Kick',duration:.92,contacts:[.46],damage:57,range:2.5,radius:.8,stamina:24,cooldown:1.2,active:HEAVY_ACTIVE,stun:.7,knockback:4,lunge:7,style:'melee',outcome:'hop',lift:5.2},
    special:{name:'Cinder Art: Burning Sea',duration:2,contacts:[.64,.92,1.2,1.48],damage:30,range:16,radius:3.6,stamina:30,cooldown:4.7,stun:.18,knockback:1,style:'field',outcome:'crumple'},
  },
  asahi:{
    // Ripple Cut: one level cut, quick and clean.
    light:{name:'Ripple Cut',duration:.44,contacts:[.16],damage:18,range:2.7,radius:.55,stamina:8,cooldown:.42,stun:.24,knockback:3,lunge:5,style:'melee'},
    // Comet Throw (4 October, combos.ts: every fighter at least one attack at range): the katana hurled like a
    // javelin, as he threw it at Sekka running for the shade (Black Snow, the Mugen Train), and back in his hand as
    // he recovers. (Water Wheel, the heavy it was, is his Jump + Heavy now: combosShop.ts.)
    heavy:{name:'Comet Throw',duration:.95,contacts:[.42],damage:58,range:18,radius:.8,stamina:24,cooldown:1.25,stun:.7,knockback:4,speed:36,style:'projectile',outcome:'stagger'},
    // Ashfall Waltz: three cuts flowing one into the next, the water ribbon round him, the last into the wall - each
    // sweeping wide enough to take whoever crowds him (at 0.9 m across it cut one at a time, and in the Rift he fell
    // in five of its twelve seeds).
    special:{name:'Ashfall Waltz',duration:1.9,contacts:[.62,1.06,1.33],damage:38,range:2.8,radius:1.4,stamina:30,cooldown:4.6,stun:.4,finisherStun:1,knockback:4,finisherKnockback:9,lunge:6,style:'melee',outcome:'wallBounce'},
  },
  levin:{
    // Shave: a reverse-grip cut, the quickest of the swords'.
    light:{name:'Shave',duration:.42,contacts:[.15],damage:18,range:2.6,radius:.55,stamina:8,cooldown:.4,stun:.23,knockback:3,lunge:5,style:'melee'},
    // Fuse Lance (4 October, combos.ts: every fighter at least one attack at range): fired off the forearm
    // launcher, it sticks and blows (Ropewalk, chapter 113: his on the Beast Colossus). It pops them off their
    // feet. (Crosshatch, the heavy it was, is his Light + Heavy now: combosShop.ts.)
    heavy:{name:'Fuse Lance',duration:.95,contacts:[.42],damage:60,range:20,radius:1.1,stamina:24,cooldown:1.25,stun:.7,knockback:5,speed:38,style:'projectile',outcome:'hop'},
    // Zipline: the grappling lines fired, and through them on them in one stroke (a dash through, as Raven Dive is):
    // it goes through a guard, and spins them round where it caught them.
    special:{name:'Zipline',duration:1.3,contacts:[.62],damage:118,range:3,radius:.8,stamina:30,cooldown:4.5,stun:1,knockback:6,lunge:9,guardBreak:true,style:'melee',chargeIn:2.8,dashThrough:true,outcome:'spin'},
  },
  'rook':{
    // Talon Cut: a reverse-grip cut, a shadow on the steel.
    light:{name:'Talon Cut',duration:.42,contacts:[.15],damage:18,range:2.5,radius:.5,stamina:8,cooldown:.4,stun:.23,knockback:3,lunge:5,style:'melee'},
    // Crossed Talons: both daggers crossed through them, into the wall.
    heavy:{name:'Crossed Talons',duration:.92,contacts:[.48],damage:57,range:2.5,radius:.8,stamina:24,cooldown:1.2,active:HEAVY_ACTIVE,stun:.7,knockback:7,lunge:8,style:'melee',outcome:'wallBounce'},
    // Grave Grip: his hand thrust out, and whatever he is looking at is lifted and slammed down, twice.
    special:{name:"Grave Grip",duration:1.7,contacts:[.66,1.12],damage:56,range:18,radius:2.6,stamina:30,cooldown:4.6,stun:.5,knockback:2,style:'field',outcome:'groundBounce'},
  },
  gaku:{
    // Lion Fist - the fist, his aura packed into it, straight through them.
    light:{name:'Lion Fist',duration:.44,contacts:[.16],damage:19,range:2.4,radius:.55,stamina:8,cooldown:.42,stun:.24,knockback:3.5,lunge:5,style:'melee'},
    // Fang Sweep - the aura drawn out of his two fingers into a blade and swept through them: they spin away.
    heavy:{name:'Fang Sweep',duration:.9,contacts:[.44],damage:57,range:2.6,radius:.85,stamina:24,cooldown:1.2,active:HEAVY_ACTIVE,stun:.7,knockback:4,lunge:7,style:'melee',outcome:'spin'},
    // Roar Palm - the aura thrown off his open palm as a blast, into the wall.
    special:{name:'Roar Palm',duration:1.5,contacts:[.7],damage:124,range:16,radius:1,stamina:30,cooldown:4.5,stun:1.1,knockback:10,speed:26,style:'projectile',outcome:'wallBounce'},
  },
} satisfies Record<FighterId, Omit<Record<AttackSlot, MoveDefinition>, 'ultimate' | 'area'> & { ultimate?: MoveDefinition; area?: MoveDefinition }>) as Record<FighterId, Record<AttackSlot, MoveDefinition>>;

/** Round 3d (ULTS): what a hit-confirm ultimate that finds nobody costs - the
 *  move ends this long after its opener's window has closed, with the bar
 *  spent. Long enough to be punished for; short
 *  enough that a whiff is a beat, not the four to seven seconds of wind-up
 *  a miss used to be. Shared by every one of them (MoveDefinition.confirm). */
export const WHIFF_RECOVERY = .5;
const WHIFF = { recovery: WHIFF_RECOVERY };
/** Round 4b (FMOVES): Banquet Infernal' damage, contact by contact (see `kosho` below). */
const KOSHO_HELL = [40, 26, 36, 50, 248];
const ULTIMATES: Record<FighterId, MoveDefinition> = {
  akaito: AKAITO_MOVES.ultimate,
  shijima: SHIJIMA_MOVES.ultimate,
  chohan:CHOHAN_MOVES.ultimate,aqrab:AQRAB_MOVES.ultimate,tsubute:TSUBUTE_MOVES.ultimate,yodaka:YODAKA_MOVES.ultimate,ume:UME_MOVES.ultimate,lanthorn:LANTHORN_MOVES.ultimate,highsun:HIGHSUN_MOVES.ultimate,torsion:TORSION_MOVES.ultimate,kubiwa:KUBIWA_MOVES.ultimate,onigawara:ONIGAWARA_MOVES.ultimate,cardo:CARDO_MOVES.ultimate,minase:MINASE_MOVES.ultimate,aquilo:AQUILO_MOVES.ultimate,'psyche':PSYCHE_MOVES.ultimate,'ovid':OVID_MOVES.ultimate,hawser:HAWSER_MOVES.ultimate,rotfalke:ROTFALKE_MOVES.ultimate,bonsho:BONSHO_MOVES.ultimate,murex:MUREX_MOVES.ultimate,kinu:KINU_MOVES.ultimate,'madake':MADAKE_MOVES.ultimate,akayuri:AKAYURI_MOVES.ultimate,hagure:HAGURE_MOVES.ultimate,hisame:HISAME_MOVES.ultimate,svanhild:SVANHILD_MOVES.ultimate,mizuhiki:MIZUHIKI_MOVES.ultimate,'shibuichi':SHIBUICHI_MOVES.ultimate,'rakucho':RAKUCHO_MOVES.ultimate,irbis:IRBIS_MOVES.ultimate,shidare:SHIDARE_MOVES.ultimate,hinomoto:HINOMOTO_MOVES.ultimate,amagoi:AMAGOI_MOVES.ultimate,'shakudo':SHAKUDO_MOVES.ultimate,hikui:HIKUI_MOVES.ultimate,tokan:TOKAN_MOVES.ultimate,strappado:STRAPPADO_MOVES.ultimate,unari:UNARI_MOVES.ultimate,barrow:BARROW_MOVES.ultimate,sashigane:SASHIGANE_MOVES.ultimate,gosu:GOSU_MOVES.ultimate,kusushi:KUSUSHI_MOVES.ultimate,
  hakushi:HAKUSHI_MOVES.ultimate,
  suzuran:SUZURAN_MOVES.ultimate,
  wataame:WATAAME_MOVES.ultimate,
  bruin:BRUIN_MOVES.ultimate,
  senko:SENKO_MOVES.ultimate,
  buna:BUNA_MOVES.ultimate,
  oyashio:OYASHIO_MOVES.ultimate,
  adad:ADAD_MOVES.ultimate,
  tempo:TEMPO_MOVES.ultimate,
  tancho: TANCHO_MOVES.ultimate,
  bellows: BELLOWS_MOVES.ultimate,
  mikage: MIKAGE_MOVES.ultimate,

  'full-beam': FULL_BEAM_MOVES.ultimate,
  pyroclast: PYROCLAST_MOVES.ultimate,
  ampere: AMPERE_MOVES.ultimate,
  shanxiao: SHANXIAO_MOVES.ultimate,
  kuzu: KUZU_MOVES.ultimate,
  shakugo: SHAKUGO_MOVES.ultimate,
  strix: STRIX_MOVES.ultimate,
  'basilissa': BASILISSA_MOVES.ultimate,
  sorayomi: SORAYOMI_MOVES.ultimate,
  // Nine blades fanned round him: whoever is inside their length is eased
  // back out to it, and the approach stops there. The RAKSHASA's lunging cut at
  // 0.45 is the opener; landed, two more cuts of the nine blades and the
  // pass-through cut as the finisher at 1.85 (it was one blow at 3.1).
  // Round 3e (ULTFIX): the RAKSHASA rises over the held victim in silence, and
  // then the nine blades cut at once - three sweeps of three swords in a
  // sixth of a second, the last the pass-through (1.42, 1.5, 1.58): 40, then
  // 56 / 51 / 148 realised. (A cinematic runs a second at least from the
  // confirm to the finisher: the camera's swing to the release shot takes
  // half of that, and the shot is held over the blows for the rest.)
  kenzo:{name:'Dust Sea Sundered',duration:2.3,contacts:[.45,1.42,1.5,1.58],schedule:[40,62,62,203],damage:40,finisherDamage:255,range:3.7,radius:1.7,stamina:0,cooldown:20,stun:.35,finisherStun:2.3,knockback:1.5,finisherKnockback:16,lunge:5,guardBreak:true,style:'melee',spacing:2.2,confirm:WHIFF},
  // Round 3: time stops where he stands (no step in: `lunge` 0), and he and
  // the spirit cross the stopped field - the GAN spread over every opponent
  // it caught, a barrage each (src/game/timeStopBarrage.ts) - and the
  // finisher lands on the primary target as the clock starts again, two
  // hundredths after the stop ends, with every other victim released in the
  // same instant. Round 3d: the stop is the opener, at 0.58 rather than
  // 0.85, and a stop that catches nobody ends the move half a second later;
  // eight GAN a sixth of a second apart from 1.0 (eleven at a fifth from
  // 1.1), the finisher at 2.5 (3.62). One opponent takes all eight and
  // realises what the eleven did.
  koko:{name:'Iron Lullaby: Hush',duration:3.3,contacts:[.58,1,1.16,1.32,1.48,1.64,1.8,1.96,2.12,2.5],damage:40,finisherDamage:245,range:3.6,radius:1.4,stamina:0,cooldown:22,stun:2.3,knockback:16,guardBreak:true,style:'melee',lunge:0,timeStop:{contact:0,duration:1.9,radius:6},confirm:WHIFF},
  // The black wave let go at 0.5 is the opener (it went at 3.1); landed, it
  // holds them inside the darkness and burns twice, and the NIGHTFALL cut is
  // the finisher at 1.9.
  // Round 3e (ULTFIX): NIGHTFALL is one cut. The wave swallows them (55), the
  // darkness holds over a second without a sound of a blow, and the one
  // moonless cut lands everything else at 1.85 (240 realised).
  nigo:{name:'Final Haizan: Nightfall',duration:2.6,contacts:[.5,1.85],schedule:[55,264],damage:55,finisherDamage:320,range:38,radius:2.4,stamina:0,cooldown:20,stun:.35,finisherStun:2.3,knockback:1.5,finisherKnockback:16,guardBreak:true,style:'beam',confirm:WHIFF},
  shirokane:{name:'Void Eye: Sickle Bolt',duration:2.85,contacts:[.48,.62,.76,2.1],schedule:[40,9,9,315],damage:40,finisherDamage:241,range:2.5,radius:1,stamina:0,cooldown:20,stun:.35,finisherStun:2.3,knockback:1.5,finisherKnockback:14,lunge:10,guardBreak:true,style:'melee',confirm:WHIFF},
  // The arrow let go at 0.5 is the opener (2.85), and it flies at 110 m/s
  // rather than 36, so it has crossed its whole forty metres by 0.86 -
  // before the cinematic's first beat at 1.05. Landed, its lightning drives
  // through them twice and bursts as the finisher at 1.95.
  // Round 3e (ULTFIX): Ikazuchi Arrow is one iconic strike. The arrow itself
  // lands hard (110), the Guardian's lightning gathers in them, and at 1.8
  // all of it goes off at once (180).
  shiden:{name:'Ikazuchi Arrow',origin:{right:.54,forward:.09,up:2.94},duration:2.55,contacts:[.5,1.8],schedule:[110,198],damage:110,finisherDamage:258,range:40,radius:2,stamina:0,cooldown:20,stun:.35,finisherStun:2.3,knockback:1.5,finisherKnockback:15,speed:110,guardBreak:true,style:'projectile',confirm:WHIFF},
  kosho:{name:'Banquet Infernal',duration:2.95,contacts:[.45,.85,1.15,1.42,2.2],schedule:KOSHO_HELL,damage:40,finisherDamage:208,range:2.4,radius:1.2,stamina:0,cooldown:20,stun:.35,finisherStun:2.3,knockback:1.5,finisherKnockback:16,lunge:5.5,guardBreak:true,style:'melee',confirm:WHIFF},
  // The beam let go at 0.52 is the opener (2.6); landed, it holds them in
  // the light and burns twice, and the blast is the finisher at 1.95.
  // Round 3e (ULTFIX): Kyokko-Ho pours through them. The beam hits (20),
  // then burns without a break - nine small blows a tenth of a second apart
  // (10 down to 4) while it pours on - and the whole of it detonates at 1.7
  // (213).
  ouga:{name:'Kyokko-Ho',duration:2.45,contacts:[.52,.65,.74,.83,.92,1.01,1.1,1.19,1.28,1.37,1.7],schedule:[20,11,11,11,11,11,11,11,11,11,609],damage:20,finisherDamage:168,range:42,radius:1.6,stamina:0,cooldown:20,stun:.35,finisherStun:2.3,knockback:1.5,finisherKnockback:16,guardBreak:true,style:'beam',confirm:WHIFF},
  taisei:{name:'Last Sun Bomb',duration:2.6,contacts:[1.5],damage:285,range:34,radius:3,stamina:0,cooldown:20,stun:2.3,knockback:16,speed:22,style:'bomb',aimOnRelease:true},
  gummy:{name:'Grand Tide',duration:3.05,contacts:[.5,2.3],damage:40,finisherDamage:280,range:10.5,radius:2.4,stamina:0,cooldown:20,stun:.35,finisherStun:2.3,knockback:1.5,finisherKnockback:16,guardBreak:true,lunge:1.5,close:0,style:'melee',confirm:WHIFF},
  // An area ultimate, with no confirm: thrown at 1.0 (1.7).
  // Round 3e (ULTFIX): its blast is 3 m round, as drawn (it was 6, and the
  // burst was drawn at 4.6): a body whose feet are outside the ring on the
  // floor is outside the blast.
  // Round 8 (ULT AIM): aimed as it leaves his hands (Kurobi's jaws), at where the body it is thrown at will be when it
  // comes down, and following them in flight - as the LAST SUN is, and for the same reason (see there). It was aimed
  // at the press, a second before it was let go.
  konta:{name:'Kitsunebi-Dama',duration:2,contacts:[1],damage:270,range:34,radius:3,stamina:0,cooldown:20,stun:2.3,knockback:16,speed:24,style:'bomb',aimOnRelease:true},
  // Great Flame Commandment: KAGUTSUCHI. A sun, thrown. Round 3b: the
  // blast is the sun as drawn - 2.2 m round with a corona of flame out to
  // about 3.1 m, set down on the floor over whoever it lands on. An area
  // ultimate, with no confirm: thrown at 1.35 rather than 3.0, at 16 m/s
  // rather than 12. Round 3e (ULTFIX): it burns every body whose feet are
  // within 3 m of that point - the corona's edge, and the ring on the floor
  // (it was 3.5, which a sidestep of three metres could not leave).
  // Round 8 (ULT AIM): aimed as it leaves his hands, at where the body it is thrown at will be when it comes down, and
  // following them in flight - as the LAST SUN is, and for the same reason (see there) - still a sun thrown down on
  // them from over his head, and still inside its 16 m. It was aimed at the press, 1.35 s before it was let go.
  kagari:{name:'Taiyou-Dama',duration:2.4,contacts:[1.35],damage:290,range:16,radius:3,stamina:0,cooldown:20,stun:2.3,knockback:16,speed:16,guardBreak:true,style:'bomb',aimOnRelease:true},
  ward:{name:'THEATRE: Flatline',duration:2.44,contacts:[.45,1.52,1.74],schedule:[40,92,202],damage:40,finisherDamage:288,range:2.6,radius:1.6,stamina:0,cooldown:20,stun:.35,finisherStun:2.3,knockback:1.5,finisherKnockback:16,lunge:12,lungeDelay:.45,guardBreak:true,style:'melee',confirm:WHIFF,
    teleport:{vanish:.45,appear:.45,reach:10.5,behind:1.15,miss:0,near:true}},
  // PLANETARIUM: everyone inside it is held, frozen under its stars,
  // and he is at each of them in turn, one strike a visit from another side
  // (timeStopBarrage.ts), the Dark Spark on the target as the dome
  // collapses. The dome is the opener, at 0.5 rather than 0.8, and one
  // that closes on nobody ends the move half a second later; four strikes
  // (six) and the Dark Spark at 2.15 (3.42).
  // Round 3e (ULTFIX): the dome is drawn on the floor from the cast - the
  // ring it will close on, filling in (CombatEffects, signature/BlastArea) -
  // and closes 0.65 s after the press on everyone still inside 3.5 m of him:
  // time to see it and get out. It closed at 0.5 on everyone within 8 m,
  // which in the practice hall was everyone, a bystander 7 m off included
  // (the third critic). The dome it raises is drawn at the same radius. The
  // strikes and the Dark Spark keep their beat after it, 0.15 s later.
  kuon:{name:'Planetarium',duration:3.15,contacts:[.65,.95,1.25,1.55,1.85,2.3],damage:42,finisherDamage:265,range:3.4,radius:1.4,stamina:0,cooldown:22,stun:2.3,knockback:16,guardBreak:true,style:'melee',lunge:0,timeStop:{contact:0,duration:1.63,radius:3.5},confirm:WHIFF},
  // MIDNIGHT: time stops, LORD ORO and HUSH GILDED PUNCH every opponent it caught,
  // and the steamroller is the finisher as the clock starts again - KoKo's
  // shape exactly, round 3d's timings included; the move runs a quarter of a
  // second past his, so the roller is seen crushed and coming apart before
  // LORD ORO is his own again (signature/Steamroller's ROLLER_TIMING).
  oro:{name:'MIDNIGHT: Death Knell',duration:3.55,contacts:[.58,1,1.16,1.32,1.48,1.64,1.8,1.96,2.12,2.5],damage:40,finisherDamage:259,range:3.6,radius:1.6,stamina:0,cooldown:22,stun:2.3,knockback:16,guardBreak:true,style:'melee',lunge:0,timeStop:{contact:0,duration:1.9,radius:6},confirm:WHIFF},
  // The overhead chop at 0.48 is the opener (1.0); landed, three more
  // swings and the two-handed slam as the finisher at 2.2 (3.3). The slam
  // lands scaled for the fifth blow of the string, where the old one landed
  // whole: 274 puts the whole rampage at the 331 it realised.
  // Round 3e (ULTFIX): the armour takes over and the rampage builds: after
  // the chop (45) each swing comes sooner and lands heavier than the last
  // (41, 46, 53 realised, 0.47 s apart down to 0.23), and the slam at 1.95
  // ends it (146).
  gaunt:{name:'Hound Rampage',duration:2.65,contacts:[.48,.95,1.25,1.48,1.95],schedule:[45,45,56,72,228],damage:45,finisherDamage:274,range:3.2,radius:1.3,stamina:0,cooldown:20,stun:.35,finisherStun:2.3,knockback:1.5,finisherKnockback:17,close:5,guardBreak:true,style:'melee',confirm:WHIFF},
  // Setsuna: Tsumuji. A blur of blows, then the one that counts. The
  // first SETSUNA strike at 0.42 is the opener (0.9); landed, the blur of
  // five more and the finisher at 1.8 (3.0) - 225 in all, as it was.
  // Round 3e (ULTFIX): a barrage is many small blows. After the opener (22)
  // seven lightning-quick strikes 0.13 s apart, hand after hand (12 down to
  // 5), a beat, and the one that counts at 1.63 (145). Any closer and the
  // strikes blur into each other on the rig (tests/fluidity.test.ts).
  setsu:{name:'Setsuna: Tsumuji',duration:2.28,contacts:[.42,.6,.73,.86,.99,1.12,1.25,1.38,1.63],schedule:[22,13,13,13,13,13,13,13,414],damage:22,finisherDamage:172,range:3,radius:1.1,stamina:0,cooldown:20,stun:.35,finisherStun:2.3,knockback:1,finisherKnockback:16,close:7,guardBreak:true,style:'melee',confirm:WHIFF},
  // The shop's fighters. TIMBER: The Forest Falls is one iconic blow: the charge's first
  // impact is the opener, and the mast-breaker, lightning down its length, the one
  // that counts at 1.6 - Gorai's whole weight in it.
  gorai:{name:'Thunderhead: Sky Anvil',duration:2.3,contacts:[.5,1.6],schedule:[40,275],damage:40,finisherDamage:328,range:3.4,radius:2.2,stamina:0,cooldown:20,stun:.35,finisherStun:2.3,knockback:1.5,finisherKnockback:17,close:7,guardBreak:true,style:'melee',confirm:WHIFF},
  // World Tilt builds: the glaive set down beside him, his left fist punches the air - the first tremor is
  // the opener, the world tilts twice more, and the last, biggest punch throws them.
  haldor:{name:'World Tilt: Seabed Rising',duration:3.1,contacts:[.55,1.25,1.8,2.35],schedule:[40,40,58,227],damage:40,finisherDamage:248,range:2.6,radius:4,stamina:0,cooldown:22,stun:.35,finisherStun:2.3,knockback:1.5,finisherKnockback:16,guardBreak:true,style:'melee',lunge:0,confirm:WHIFF},
  // Horizon Sunder is a one-cut, NIGHTFALL's way: the opener goes out down the
  // line, and the Gryphon comes down through whoever it held.
  sorrel:{name:'Horizon Sunder',duration:2.4,contacts:[.5,1.6],schedule:[45,269],damage:45,finisherDamage:323,range:30,radius:2.2,stamina:0,cooldown:20,stun:.35,finisherStun:2.3,knockback:1.5,finisherKnockback:16,guardBreak:true,style:'beam',confirm:WHIFF},
  // HORIZON SUNDER, the cut that split the heavens over Dorado's clash with
  // Haldor: the cloak thrown round as Kagari goes up is the opener, and the
  // one cut that counts comes down through whoever it caught. Sorrel throws
  // his down the line; Dorado's is at arm's length.
  dorado:{name:'Last Light: Sunset Divide',duration:2.36,contacts:[.55,1.62],schedule:[50,264],damage:50,finisherDamage:318,range:3.2,radius:2.4,stamina:0,cooldown:20,stun:.35,finisherStun:2.3,knockback:1.5,finisherKnockback:17,close:7,guardBreak:true,style:'melee',confirm:WHIFF},
  // Hymn 40: Black Confessional, cast where he points: the coffin of black pressure
  // closes round them - the opener, at range, as Black Pyre is - three spears
  // come through it, and it bursts. (Each shop ultimate was the same two blows
  // on the same beats, the blind critics, 3 October; the whole lands as before.
  // In a Rift nothing holds them, and the blows between knocked the crowd out of
  // reach of the last and filled the echoes' cap: those blows barely push now and
  // the opener carries more, and the six fell and progressed as they did over
  // 36 runs each - scripts/survival/rift_run.ts.)
  shiun:{name:'Hymn 40: Black Confessional',duration:2.5,contacts:[.52,1.3,1.45,1.6,1.84],schedule:[52,22,24,26,280],damage:52,finisherDamage:160,range:18,radius:2.4,stamina:0,cooldown:20,stun:.35,finisherStun:2.3,knockback:0,finisherKnockback:14,guardBreak:true,style:'field',confirm:WHIFF},
  magatsu:{name:'Sanctum: Carrion Altar',duration:3.15,contacts:[.65,.9,1.1,1.3,1.5,2.3],damage:60,finisherDamage:128,range:3.4,radius:2.4,stamina:0,cooldown:22,stun:2.3,knockback:.4,finisherKnockback:12,guardBreak:true,style:'melee',lunge:0,timeStop:{contact:0,duration:1.63,radius:3.5},confirm:WHIFF},
  // The Offering - the sabre's thrust is the opener; then the sun goes black over whoever it held, the brand
  // burns on them, and he comes down out of the dark with the sabre: the Dark Choir's judgement.
  vesper:{name:'The Offering',duration:2.4,contacts:[.4,1.78],schedule:[44,270],damage:44,finisherDamage:324,range:3,radius:2.4,stamina:0,cooldown:20,stun:.35,finisherStun:2.3,knockback:1.5,finisherKnockback:17,close:7,guardBreak:true,style:'melee',confirm:WHIFF},
  // The Final Molt - a punch is the opener; then a blow out of his combo, and both fists brought down onto
  // whoever it held.
  imago:{name:"The Final Molt",duration:2.3,contacts:[.42,.98,1.62],schedule:[40,60,238],damage:40,finisherDamage:288,range:3,radius:2.4,stamina:0,cooldown:20,stun:.35,finisherStun:2.3,knockback:1.5,finisherKnockback:17,close:7,guardBreak:true,style:'melee',confirm:WHIFF},
  // Heaven's Harvest - the flying kick of his rush is the opener; then both hands drawn up over his head, Rose's ki
  // drawn out of them into a scythe that sweeps them once as it forms, and the scythe brought down through them.
  'wuming':{name:'Heaven\'s Harvest',duration:2.5,contacts:[.4,1.15,1.8],schedule:[60,40,237],damage:60,finisherDamage:248,range:3,radius:2.4,stamina:0,cooldown:20,stun:.35,finisherStun:2.3,knockback:.4,finisherKnockback:17,close:7,guardBreak:true,style:'melee',confirm:WHIFF},
  // Mountain-Felling Fist: the hook out of his rush is the opener; landed, he leaps with the right fist raised over his
  // head and dives through them behind it - the card's colossal punch - a wind-up and one blow.
  jirenga:{name:'Mountain-Felling Fist',duration:2.55,contacts:[.45,1.85],schedule:[52,261],damage:52,finisherDamage:316,range:3,radius:2.4,stamina:0,cooldown:20,stun:.35,finisherStun:2.3,knockback:1.5,finisherKnockback:18,close:7,guardBreak:true,style:'melee',confirm:WHIFF},
  // The Drowned Sun: one hand raised, the ball grown on it until it dwarfs him, and flung - an area ultimate, as
  // the LAST SUN is: everyone in the blast.
  // Round 8 (ULT AIM): aimed as it leaves his finger, at where the body it is thrown at will be when it comes down, and
  // following them in flight - as the LAST SUN is, and for the same reason (see there). It was aimed at the press,
  // 1.45 s before it was let go.
  'jinlin':{name:'Drowned Sun',duration:2.6,contacts:[1.45],damage:290,range:30,radius:3.2,stamina:0,cooldown:20,stun:2.3,knockback:16,speed:16,guardBreak:true,style:'bomb',aimOnRelease:true},
  // The Sun-Seizing Spiral: two fingers to his forehead, the ki drawn to a point there, and the arm thrown out - the
  // beam let go is the opener; landed, its spiral bores on through whoever it held, and the beam bursts out behind
  // them as the finisher.
  // Red Moon Reverie - the flick of the kunai is the opener; landed, the moon goes red over whoever it caught and they are
  // held in his illusion while he makes the sign - stabbed in it again and again, seventy-two hours in an instant -
  // and it breaks them.
  tobari:{name:'Red Moon Reverie',duration:2.5,contacts:[.42,1,1.12,1.24,1.36,1.48,1.8],schedule:[46,12,13,14,15,16,420],damage:46,finisherDamage:92,range:3,radius:2.4,stamina:0,cooldown:20,stun:.35,finisherStun:2.3,knockback:.4,finisherKnockback:10,close:7,guardBreak:true,style:'melee',confirm:WHIFF},
  // Heaven's Anvil - the war fan's slash is the opener; landed, his arms go up and a meteor comes down out of the
  // sky onto whoever it caught.
  akagane:{name:'Heaven\'s Anvil',duration:2.5,contacts:[.42,1.8],schedule:[60,253],damage:60,finisherDamage:308,range:3,radius:2.6,stamina:0,cooldown:20,stun:.35,finisherStun:2.3,knockback:1.5,finisherKnockback:12,close:7,guardBreak:true,style:'melee',confirm:WHIFF},
  // Lantern Rite: First Light - a thrust is the opener; landed, the turning cut of the Fire God's dance, then the leap and its
  // cut, burning, brought down through them.
  asahi:{name:'Lantern Rite: First Light',duration:2.4,contacts:[.4,1.1,1.78],schedule:[62,44,229],damage:62,finisherDamage:244,range:3,radius:2.4,stamina:0,cooldown:20,stun:.35,finisherStun:2.3,knockback:.4,finisherKnockback:16,close:7,guardBreak:true,style:'melee',confirm:WHIFF},
  // SOJI: Clean Sweep - a slash is the opener; landed, he goes up off the floor turning, both blades, cut on cut, and
  // the last throws them. (The cuts came after 0.6 s of him standing in the slash's follow-through, and the last pass
  // a second after the first cut - "dead air", the blind critics, after release 34: they follow the slash at once.)
  levin:{name:'SOJI: Clean Sweep',duration:2.2,contacts:[.42,.7,.82,.94,1.06,1.18,1.5],schedule:[46,16,16,16,16,16,403],damage:46,finisherDamage:92,range:3,radius:2.4,stamina:0,cooldown:20,stun:.35,finisherStun:2.3,knockback:.4,finisherKnockback:15,close:7,guardBreak:true,style:'melee',confirm:WHIFF},
  // Black Rookery - a dagger cut is the opener; landed, he raises his hand and the shadows of the fallen rise behind him and
  // fall on whoever it held, one after another, the last of them with him.
  'rook':{name:'Black Rookery',duration:2.5,contacts:[.42,1.25,1.4,1.55,1.8],schedule:[50,20,22,24,291],damage:50,finisherDamage:168,range:3,radius:2.4,stamina:0,cooldown:20,stun:.35,finisherStun:2.3,knockback:.4,finisherKnockback:14,close:7,guardBreak:true,style:'melee',confirm:WHIFF},
  // Landslide - "Saisho wa gū": his straight is the opener; landed, the fist raised over his head while the aura
  // floods into it, and the Landslide's fist brought down through them with everything he has.
  gaku:{name:'Landslide',duration:2.5,contacts:[.42,1.8],schedule:[68,244],damage:68,finisherDamage:300,range:3,radius:2.4,stamina:0,cooldown:20,stun:.35,finisherStun:2.3,knockback:1.5,finisherKnockback:16,close:7,guardBreak:true,style:'melee',confirm:WHIFF},
  // Gravedigger: Shatter Art: Black Blizzard - the one-two out of his rush is the opener; landed, he goes through them in a
  // dash and drives everything he has into one blow.
  sekka:{name:'Shatter Art: Black Blizzard',duration:2.5,contacts:[.42,1.75],schedule:[56,257],damage:56,finisherDamage:312,range:3,radius:2.4,stamina:0,cooldown:20,stun:.35,finisherStun:2.3,knockback:1.5,finisherKnockback:19,close:7,guardBreak:true,style:'melee',confirm:WHIFF},
  ippon:{name:'Clean Slate',duration:2.2,contacts:[.5,1.55],schedule:[54,259],damage:54,finisherDamage:314,range:3,radius:2.4,stamina:0,cooldown:20,stun:.35,finisherStun:2.3,knockback:1.5,finisherKnockback:24,close:7,guardBreak:true,style:'melee',confirm:WHIFF},
  'gohaku':{name:'Sun-Seizing Spiral',duration:2.5,contacts:[.55,1.8],schedule:[48,266],damage:48,finisherDamage:320,range:42,radius:1.1,stamina:0,cooldown:20,stun:.35,finisherStun:2.3,knockback:1.5,finisherKnockback:16,guardBreak:true,style:'beam',confirm:WHIFF},
};
for (const fighter of Object.keys(ULTIMATES) as FighterId[]) MOVES[fighter].ultimate = ULTIMATES[fighter];
// Each fighter's table is copied as it gains its area move, so a fighter's own file (AMAGOI_MOVES...) keeps its four:
// what the house kits, the Forge and the packs put in MOVES never reaches the authored tables either.
for (const fighter of Object.keys(MOVES) as FighterId[]) MOVES[fighter] = { ...MOVES[fighter], area: areaMoveOf(fighter) };

/** Impact freeze, in seconds, by the slot that landed. Both fighters stop dead
 *  for these few frames; it is the single largest contributor to a hit reading
 *  as a collision rather than two animations overlapping. */
export const HITSTOP: Record<AttackSlot, number> = { light: .08, heavy: .13, special: .16, ultimate: .22, area: .16 };
export const BIG_HITSTOP = { special: .22, ultimate: .26, ender: .2, finisher: .17 } as const;
/** v70, the dream loop's throw (23 October 2026): a combo ender's struck body (the blowback, the launcher, the knockdown,
 *  the air strike) is held at most this long - frozen in the pose it was hit into, flashed and shaken as ever
 *  (Fighter.impactPose) - and then thrown within two or three frames; it was held 0.15-0.2 s
 *  inside the burst (the blind critics, every heavy blow: "Ouga still sits in the middle of it"). The thrower's hold is
 *  its slot's, as before. A special's and an ultimate's last blow keep BIG_HITSTOP, and so does a rush finisher: its
 *  tumble is laid along that hold, and cut short it swung a hand 15-27 cm in a frame (tests/reactionTakes). */
export const BIG_ENDER_HOLD = .04;
/** How much longer a big blow that launches into a juggle may hold its victim (see BIG_HITSTOP). */
export const BIG_LAUNCH_MOST = .04;
/** Frame advantage, in seconds. What a landed hit buys over and above the
 *  recovery its thrower still owes: hitstun is floored at the wind-up the
 *  attacker paid plus this, so connecting leaves them ahead. Measured, every
 *  normal in the roster was between -0.11 s and -0.26 s on hit - landing a jab
 *  handed the initiative to the fighter who had just been hit by it, which is
 *  most of why exchanges read as two people taking turns rather than as one
 *  pressing an advantage. */
export const ADV_ON_HIT: Record<AttackSlot, number> = { light: .06, heavy: .1, special: .16, ultimate: .5, area: .16 };
/** The ceiling on that floor, so a long wind-up does not buy a free combo. */
export const MAX_FLOOR_STUN: Record<AttackSlot, number> = { light: .5, heavy: .7, special: .9, ultimate: 2.3, area: .9 };
/** The combo breaker. Six chained CASTS hand control back: the sixth is
 *  escaped rather than taken. It used to do that in silence and with 0.6 s of
 *  evade - attacks visibly passed through a body standing in front of you - so
 *  it now shoves the pair apart, freezes both and announces itself, over a
 *  window that is only as long as it takes to get out of the swing that is out.
 *
 *  Casts, not contacts. The budget used to count every contact and then read
 *  its threshold off whichever move had just landed, so Konta's three-hit
 *  light tripped it on his second cast while KoKo could push past it by
 *  switching into GAN. It is charged once per cast now, on the first contact
 *  of that cast to land, and it never fires in the middle of a multi-contact
 *  cast: only on a cast's first contact, or on its last. */
export const BREAK_CASTS = 6;
export const BREAK_EVADE = .28;
export const BREAK_PUSH = 7;
export const BREAK_FREEZE = .12;
/** Blocking costs, and what it does not cost.
 *
 *  Chip is a fraction of the blocked damage, by slot. Holding guard has to be
 *  safe and not free: a perfect defence should still lose a long round, and a
 *  fighter behind on health should still have a way through. A normal cannot
 *  chip someone to death - that is what the floor at 1 is for - but an ultimate
 *  can, which is what makes spending the bar on one a real threat. */
export const CHIP: Record<AttackSlot, number> = { light: .04, heavy: .06, special: .1, ultimate: .18, area: .1 };
export const GUARD_COST: Record<AttackSlot, number> = { light: 5, heavy: 14, special: 20, ultimate: 30, area: 20 };
export const GUARD_COST_DAMAGE = .15;
export const GUARD_REAR_COST = 1.5;
/** The front, as a dot product of the facing and the way to the blow's source: about 78 degrees either side. */
export const GUARD_FRONT = .2;
export const JUST_GUARD_WINDOW = .25;
/** A press only opens the window if the button had been up this long: mashing F at eight or ten presses a second
 *  never lets go long enough to arm one. A deliberate tap off a held guard does. */
export const PARRY_REARM = .1;
/** A window that closed on nothing locks the next ones out for this long after it: a press that whiffs costs the
 *  parry, not the guard (the guard still comes up and still blocks).
 *
 *  Parry for people: 0.45 s with the 0.16 s window, 0.7 s with the 0.25 s one. Fishing - tapping guard on a steady
 *  beat, open between the taps - covers at most window / (window + lockout) of the clock: 26% before, 26% now (it
 *  would have been 36% had the lockout stayed), so it still takes about three times the clean hits a held guard
 *  does for the parries it fishes. */
export const PARRY_LOCKOUT = .7;
/** How long a parried thrower staggers, after the shared freeze. Long enough for every heavy on the roster to land
 *  from wherever the parry left the defender, the slowest included (a 0.5 s wind-up and the step in): proven fighter
 *  by fighter in tests/parry.test.ts. Was 0.34, which only the lights could use. */
export const JUST_GUARD_ADVANTAGE = .72;
/** The parry's hit-stop, on both bodies, owned by the simulation (every authority timer holds through it, so the
 *  advantage above is untouched by it). The beat that sells the read: as long as a special's big blow holds its victim
 *  (BIG_HITSTOP.special), so a parry never weighs less than the blows it answers. */
export const PARRY_FREEZE = .22;
export const JUST_GUARD_METER = 12;
/** The guard the parry gives back. */
export const PARRY_STAMINA = 15;
/** Only a thrower within this of the defender is staggered: a shot parried at point blank is a blow parried; one
 *  thrown from across the arena is only destroyed, and its thrower plays out the rest of their move.
 *
 *  Destroyed, not reflected. A reflected shot in a twelve-fighter royale mostly finds nobody, or a bystander - a
 *  random reward for the read, where the parry's meter, stamina and guard are a sure one. Two zoners would bat one
 *  shot back and forth (Duel especially), and a red special thrown back would be a guard break on its own thrower.
 *  And a shot rides its thrower's rollback checkpoint (`predictionCheckpoint`'s `shots`): changing hands mid-flight
 *  would leave both clients predicting a shot the other owns. A beam is the cast itself, so a parried beam is cut off
 *  where it meets the guard - the same "destroyed" from a different body. */
export const PARRY_REACH = 4.5;
/** Arcade survival's bodies (anything with a kit) reel for the parry's old length: their bosses' brains and the
 *  arcade's balance were built round it, and the arcade staggers its own grunts (SurvivalGame, horde.stagger). */
export const JUST_GUARD_ADVANTAGE_KIT = .34;
/** A body driven into a wall at this speed sticks to it instead of sliding
 *  down it - or any body still in the air from the launch that sent it there,
 *  because knockback decays fast and a threshold alone would mean the splat
 *  only ever fired in the two frames after the hit. The stun is comboable on
 *  purpose: a 13 m room should reward putting someone in a corner. */
export const WALL_SPLAT_SPEED = 4;
export const WALL_SPLAT_STUN = .8;
/** A finisher that lands on someone already in the air drives them down, and
 *  they bounce once off the floor before the knockdown. */
export const GROUND_BOUNCE_LIFT = 5.4;
/** Ground movement is a ramp, not a switch. Before this, velocity went from
 *  nothing to the full 7.5 m/s in a single tick and back again, which is most
 *  of what made a fighter read as weightless. Stopping is quicker than
 *  starting, because that is what feet do. */
export const GROUND_ACCEL = 95;
export const GROUND_BRAKE = 140;
/** Reversals shed the old heading promptly, without axis-dependent snapping. */
export const GROUND_TURN_ACCEL = 180;
/** How much of that authority is left in the air. */
export const AIR_CONTROL = .35;
/** Blocking has to be something both fighters feel. A blocked hit shoves the
 *  defender, shoves the attacker back rather less, freezes both for a fraction
 *  of the hit's own stop, and holds the defender in their guard for this long -
 *  during which they cannot swing back. Before this a blocked heavy moved
 *  nobody at all: the accent printed and both bodies carried on. */
export const BLOCK_STUN: Record<AttackSlot, number> = { light: .13, heavy: .2, special: .26, ultimate: .32, area: .26 };
/** Round 5 (PARRY): the shove, as the speed it starts at under BLOCK_DRAG - a distance of push / drag. It was
 *  0.2-0.6 m, which the next lunge ate whole: a blocked string never gave the defender any room. A string's last
 *  blow and an ender now push the pair apart (BLOCK_PUSH_ENDER), so blocking a whole string ends the exchange
 *  rather than leaving the attacker standing in it. The attacker takes BLOCK_RECOIL of it. */
export const BLOCK_PUSH: Record<AttackSlot, number> = { light: 3.6, heavy: 9.6, special: 12, ultimate: 14, area: 12 };
export const BLOCK_PUSH_ENDER = 10.8;
export const BLOCK_DRAG = 12;
export const BLOCK_RECOIL = .4;

/** How close a melee lunge brings the two fighters, centre to centre, before
 *  the blow lands. Two bodies touch at 0.9 m.
 *
 *  Only Taisei had one of these, and he is the only fighter whose punches read
 *  as landing on somebody. Measured on everyone else, a melee hit fired with
 *  between 1.2 and 4.4 metres of clear air between the two models: KoKo's
 *  Needle Finger connected across four and a half metres of nothing. The reach
 *  each fighter actually has is in src/game/data/contactReach.json, measured
 *  off the animation by scripts/measure_contact_reach.mjs; these are that,
 *  less enough that the striking surface passes through the target rather than
 *  stopping at its skin. A fighter who kicks needs the room to swing a leg. */
//
//  Re-tuned in round 13 against the effector-only reach (the old table let a
//  trailing foot or a blade at ninety degrees count as reach). Every entry
//  now sits inside 0.2 m of the pushbox (PUSH_RADIUS * 2 = 1.1), so the
//  lunge leaves no more than a hand's breadth of air between the bodies at
//  contact; the swordsmen and the kicker used to stop 0.35-0.5 m out. A
//  normal whose reach is less than this closes to the pushbox instead - see
//  `contactGap`.
// Round 3d (PACE): Taisei's was 0.9, inside the 1.1 m the separation holds two
// bodies at, so every approach of his shoved his victim along in front of him
// at the approach's speed. With his string's stages 0.07 s quicker that was
// 4.8 m/s, and a victim drawn a round trip late was left 0.4 m behind the
// fist (tests/contactPush.test.ts). His blows land from 1.14 m; at the
// pushbox he steps in and stops, like everyone else.
export const BODY_SIZE: Partial<Record<FighterId, number>> = { gorai: 1.5 };
export const CONTACT_GAP: Record<FighterId, number> = {
  chohan:1.17,
  aqrab:1.2,
  tsubute:1.12,
  yodaka:1.2,ume:1.16,lanthorn:1.14,highsun:1.3,torsion:1.1,kubiwa:1.12,onigawara:1.3,cardo:1.3,minase:1.12,aquilo:1.12,'psyche':1.12,'ovid':1.15,hawser:1.25,rotfalke:1.35,bonsho:1.1,murex:1.10,kinu:1.2,'madake':1.12,akayuri:1.1,hagure:1.12,hisame:1.2,svanhild:1.2,mizuhiki:1.15,'shibuichi':1.26,'rakucho':1.14,irbis:1.14,shidare:1.15,hinomoto:1.22,amagoi:1.12,'shakudo':1.08,hikui:1.1,tokan:1.2,strappado:1.3,unari:1.2,barrow:1.45,sashigane:1.25,gosu:1.25,kusushi:1.2,hakushi:1.2,suzuran:1.15,wataame:1.55,bruin:1.55,
  senko:1.4,buna:1.65,
  oyashio:1.45,adad:1.2,
  akaito: 1.15,
  shijima: 1.05,
  tempo:1.15,
  tancho: 1.2, bellows: 1.3, mikage: 1.15,
  'full-beam': 1.3,
  pyroclast: 1.2,
  ampere: 1.12,
  shanxiao: 1.4,
  kuzu: 1.18,
  shakugo: 1.65,
  strix: 1.4,
  'basilissa': 1.05,
  sorayomi: 1.2,
  taisei: 1.1, kosho: 1.3, kenzo: 1.3, nigo: 1.3, gummy: 1.3,
  koko: 1.25, shirokane: 1.1, shiden: 1.1, ouga: 1.2, konta: 1.15,
  kagari: 1.3, ward: 1.35, kuon: 1.2, oro: 1.25, gaunt: 1.4, setsu: 1.1,
  gorai: 1.45, haldor: 1.45, sorrel: 1.3, dorado: 1.3, shiun: 1.3, magatsu: 1.2, vesper: 1.3, imago: 1.15, 'wuming': 1.15, jirenga: 1.4, 'jinlin': 1.15, 'gohaku': 1.15, ippon: 1.2, sekka: 1.2, tobari: 1.2, akagane: 1.2, asahi: 1.25, levin: 1.25, 'rook': 1.2, gaku: 1.15,
};
/** The fastest a lunge may close, in metres a second, and the furthest gap it
 *  will try to close at all. A step into range is a step; crossing eight
 *  metres inside a light's wind-up is a teleport, and a swing thrown at
 *  somebody that far away should simply miss. */
// Twelve, not nineteen. The solve below asks for whatever speed closes the
// remaining gap by the frame of contact, and nineteen is twice a world-record
// sprint - a body that arrives by teleporting rather than by stepping, which
// is most of why a lunge reads as a slide. Twelve is the lowest the roster
// takes as it is timed today: taisei's light has 0.13 s of wind-up to cross two
// metres in, and that is what sets the floor.
export const MAX_APPROACH = 12;
export const MAX_CLOSE = 3.2;

/** How far a melee blow may land from the fighter throwing it, centre to
 *  centre. Only Taisei had one of these, and he was the only one whose punches
 *  read as landing on somebody: measured, everyone else connected with between
 *  1.2 and 4.4 metres of clear air between the two models.
 *
 *  The reach comes from the animation - the furthest any striking surface gets
 *  from the fighter's own origin at the frame the damage lands, blade tip
 *  included - and is capped by the move's authored range, so nothing reaches
 *  further than it used to. Two fighters whose blow is not their own body need
 *  an override: Iron Spirit throws KoKo's punches from in front of him,
 *  and Gummy's arm stretches at runtime.
 *
 *  See scripts/measure_contact_reach.mjs. */
const REACH = contactReach as Partial<Record<FighterId, Partial<Record<AttackSlot, number>>>>;
const REACH_OVERRIDE: Partial<Record<FighterId, Partial<Record<AttackSlot, number>>>> = {
  // Iron Spirit throws these from in front of KoKo, so the measurement -
  // which watches KoKo's own body - is not what does the hitting. His heavy
  // used to be here as well; Needle Finger is a projectile now and needs no
  // reach. Gummy used to be here too, on the grounds that his arm stretches;
  // it does, but only where the clip scales the forearm, which his
  // ultimate's opener did not. It carried a `close` instead, so he travelled
  // rather than reaching (his special is a line of fists: Fighter.ts RUBBER).
  koko: { special: 2.1, ultimate: 2.4 },
  // Round 6 (GUMMY ULT): and he is back, for the ultimate alone. Its opener is SUNRISE's grab now - the hand shot out on
  // the stretched arm to the body it is thrown at, the whole way (Fighter.ts GRAND_TIDE_GRAB) - so its reach is the arm's:
  // 11 m centre to centre with the slack (ULTIMATES.gummy).
  gummy: { ultimate: 10.3 },
  // Crimson Command is not the blade: it goes out round Sorrel to its radius,
  // wherever the Gryphon is at the time.
  sorrel: { special: 4.2 },
  // Nor are Shiun's blows his hand: False Encore's blade runs 0.79 m on past
  // his fist, and lands where the illusion breaks - measured, the hand itself
  // gets 0.29 and 0.43 m ahead of him.
  shiun: { light: 1.6, heavy: 2.2 },
  magatsu: { light: 2, ultimate: 3.2 },
  // Imago's tail is the blow, not the fist the measurement watches: it comes round past his foot on the Tail
  // Whip, and Stinger Storm sweeps it round him to its radius, as Crimson Command goes out round Sorrel. His claw
  // sweeps wider than the point of the fist (0.79 m measured), as Shiun's palm throws its force on.
  imago: { light: 1.6, heavy: 2.2, special: 3.6 },
  // Wuming's Petalfall Blade is a blade of ki out of his hand, not the hand; the Heaven's Harvest's opener is
  // a kick, which the measurement (off the fist) does not watch.
  'wuming': { heavy: 2, ultimate: 2 },
  // Jirenga's Uprooting Fist goes up, not out: an uppercut stepped into, the fist up past his own chin 0.64 m ahead of
  // where he stood (scripts/economy/uprooting_fist.py, after release 34) - the lunge takes him to the pushbox first, so a
  // duel's blow lands as drawn. It keeps the reach his leap had: at 1 m it went into a crowd for a third
  // less, and he fell in three of the Rift's twelve seeds (scripts/survival/rift_run.ts). Emperor Jinlin's Pearl Needle
  // lands where the beam off his fingertip does, past the hand; his Whirlpool Tail with the tail, which the fist the
  // measurement watches never reaches.
  jirenga: { heavy: 1.5 },
  'jinlin': { light: 2.2, heavy: 2.4 },
  // Gohaku's Rising Kick lands with the right foot, a metre ahead of his hips at chest height - not the fist
  // the measurement watches.
  'gohaku': { heavy: 1.6 },
  // Three clips whose blow never clears the pushbox. Measured honestly -
  // the striking limb, projected onto the facing, at the contact frame -
  // Senpugan reaches 0.28 m ahead of Konta's origin (the clip steps back
  // 0.6 m before the slam and the fist never passes 0.25 m in the whole
  // move), the Barrage's punches 0.48 m (an overhead whose fist ends 1.9 m
  // up), and Habakiri Cut's tip peaks at 0.39 m (its horizontal sweep is
  // held 0.7 m to Shiden's right at 0.3 m out). The bodies are held
  // PUSH_RADIUS * 2 = 1.1 m apart, and 0.28 + PLAYER_RADIUS + MELEE_SLACK
  // is 0.93: Senpugan could never land, and the Barrage's 1.13 left it to
  // the separation jitter. These are the pushbox floor, not measurements:
  // 0.65 puts the hit range at 1.3 m, the pushbox plus the same frame of
  // movement every other blow is given, so the blow lands only when the
  // two are touching. The honest fix is a clip whose blow actually reaches.
  // The old figures (0.86, 1.18 and 0.61) were a trailing foot, the other
  // hand, and a blade at ninety degrees respectively.
  konta: { light: .65, heavy: .65 },
  shiden: { light: .65 },
  // Kuon's light is the same case: Hex Strike is an overhead hammer blow
  // whose fist peaks 0.44 m ahead of his origin at the contact frame
  // (scripts/probe_kuon_fist.mts, 0.80 rig units at 0.74 of the clip), which
  // with the radius and the slack is 1.09 m against a 1.11 m pushbox.
  kuon: { light: .65 },
  // HUSH throws Lord ORO's barrage and his finisher from in front of him,
  // exactly as Iron Spirit does for KoKo.
  oro: { special: 2.1, ultimate: 2.4 },
  // The sixth wave's measured reach is the fist's (the measurement watches the hands): Akagane's Rising Kick lands with
  // the foot, and his War Fan Sweep with the war fan's face, half a metre past the hand (0.43 m measured). Asahi's
  // katana is measured now that it is held (1.04, 0.92 and 1.07 m, 3 October); his cuts keep the reach his balance was
  // set on. (Levin's Crosshatch was here at 1.3 m for both blades brought down past his hands; his own cut, 3 October, is
  // measured at the blades' tips.)
  akagane: { light: 1, heavy: 1.35 },
  asahi: { light: 1.25, heavy: 1.3, special: 1.25 },
  // Gaku's Scissors is the aura drawn out of his two fingers into a blade: the cut lands where the blade does, about a
  // blade's length past the hand the measurement watches (0.44 m). His guard's straight (his own, 3 October) is a
  // small boy's: the fist out at its furthest 0.44 m ahead of him, a centimetre inside the pushbox, so his string
  // whiffed at touching distance (seen in Chrome). It takes the pushbox floor, as Konta's Senpugan does. First Comes
  // Rock's opener measures 0.60 m on his new jab, but is held at the 0.52 m his old punch had: at 0.60 he fell in five
  // of the twelve Rift seeds and dealt a fifth less (at 0.52, two, and 1.48 M a run).
  gaku: { light: .65, heavy: 1.25, ultimate: .52 },
};
/** Room for the target's own body and a frame of movement. */
const MELEE_SLACK = .2;
/** How close the lunge brings the two of them for a particular blow. The
 *  per-fighter figure is a comfortable distance for a normal; a move whose
 *  striking surface reaches less far than that has to close further or it
 *  stops outside its own reach and whiffs every time - which is what Signal Fire
 *  did the moment its range stopped being a travel distance. */
export function contactGap(fighter: FighterId, slot: AttackSlot, move: MoveDefinition, grounded=true) {
  const comfortable = CONTACT_GAP[fighter] ?? 1.25;
  const reach = meleeReach(fighter, slot, move, grounded);
  if (!Number.isFinite(reach)) return comfortable;
  return Math.max(PLAYER_RADIUS * 2, Math.min(comfortable, reach - .3));
}

export function meleeReach(fighter: FighterId, slot: AttackSlot, move: MoveDefinition, grounded=true) {
  if (move.style !== 'melee') return Infinity;
  if (move.ender) return move.range + PLAYER_RADIUS;
  // The rebuilt grounded Senpugan's palm center reaches .637m; its
  // .215m sphere adds a real striking surface. Kurobi retains the old reach.
  const measured = move.reach ?? (grounded&&fighter==='konta'&&slot==='heavy'&&move.name==='Senpugan'?.85
    :REACH_OVERRIDE[fighter]?.[slot] ?? REACH[fighter]?.[slot]);
  if (measured === undefined) return move.range + PLAYER_RADIUS;
  return Math.min(move.range + PLAYER_RADIUS, measured + PLAYER_RADIUS + MELEE_SLACK);
}

/** A hit this hard takes the target off their feet instead of staggering them. */
export const LAUNCH_KNOCKBACK = 6;
/** How long a body a launch put on the floor stays down: an ultimate's, a
 *  kit's and anything else with no `outcome` of its own (a move that has one
 *  goes by OUTCOME_DOWN). */
export const KNOCKDOWN_SECONDS = .62;
/** Round 3e (VARIETY): 0.4 s getting up, from 0.48 - the dead air after a
 *  knockdown. Ground hits (8 October 2026): a fighter's normals are dodged
 *  through it, and an ultimate connects (see GROUND_HIT_SCALE). */
export const GETUP_SECONDS = .4;
export const GROUND_HIT_SCALE = .5;
export const GROUND_HIT_HOLD = .2, GROUND_HIT_MOST = .3;
export const GROUND_HIT_SHOVE = 3;
export const GROUND_HIT_SCALES: readonly number[] = [GROUND_HIT_SCALE, .35, .2, .1];
export const GROUND_HIT_BUDGET = .055;
/** What a ground hit takes off: a blow worth `standing` on a body on its feet (after a string's scaling and anything
 *  else that body's blows are scaled by), landing as the `hits`-th ground hit of the stay (0, the first) with `taken`
 *  gone in the stay already, on a body of `maxHp`. Whole points: at least 1 while the budget lasts, and 0 once it is
 *  spent. */
export function groundHitDamage(standing: number, hits: number, taken: number, maxHp: number): number {
  const left = Math.round(maxHp * GROUND_HIT_BUDGET) - taken;
  if (!(left > 0)) return 0;
  const scale = GROUND_HIT_SCALES[Math.min(Math.max(0, Math.floor(hits)), GROUND_HIT_SCALES.length - 1)];
  return Math.min(left, Math.max(1, Math.round(standing * scale)));
}
/** Dizzy after a guard break: the reward for breaking a guard. */
export const GUARD_BREAK_STUN = 1.15;
/** How long a string stays alive between hits, for the combo count and scaling. */
export const COMBO_WINDOW = 1.4;
/** Stages in the light rush string. Stage 0 is each fighter's own light and
 *  stays `MOVES[id].light`; stages 1..RUSH_STAGES-1 are the follow-ups a light
 *  pressed into the previous stage carries into, each a single contact, the
 *  last one the finisher that sends the target away. PlayerState.chain says
 *  which one is playing. */
export const RUSH_STAGES = 4;
/** How long after a rush stage has finished a light press still carries the
 *  string on instead of starting it again. A rush plays out whether
 *  or not it connects: a whiffed stage stays committed - nothing cancels it
 *  early - but a press made during it, or within this window after it, is the
 *  next stage rather than the jab again. A connected stage takes the next one
 *  as a cancel, the moment its own contacts are spent. */
export const RUSH_WINDOW = .3;
/** An airborne string stops at stage 2: it has no finisher of its own. The
 *  juggle that carries it is already spending the target's air budget, and a
 *  launcher thrown at somebody already falling has nowhere to send them. */
export const RUSH_AIR_STAGES = 3;
/** Round 4b (COMBAT): deliberate strings over mashing. The blind critic found mashing J at 90 ms dealing 90-109% of
 *  the best Light x3 ender, launching and chasing by itself. Fighter against fighter (a duel: a royale, training, a
 *  private room, Bad Blood - not a horde, nor a survival boss, whose blows are not a string):
 *    - a light pressed sooner than MASH_INTERVAL after the one before is mashed, and it taints the string it is pressed
 *      into: every light stage of that string, and of a string a mashed press opens, is worth MASH_SCALE of itself;
 *    - a combo ender is the string's payoff: the string's damage scaling bites it at ENDER_SCALING of its rate;
 *    - an ender pressed on the beat - not mashed, once the stage it ends has landed its blow (BEAT_EARLY before it at
 *      the earliest), and not queued behind a light still waiting - is worth RHYTHM_BONUS;
 *    - the light chase (LIGHT_CHASE_WINDOW) is a timed light: a mashed press never chases, it waits under them.
 *  A rhythm of 0.25-0.35 s a press is never mashing (tests/comboCadence.test.ts). */
export const MASH_INTERVAL = .14, MASH_SCALE = .75;
export const BEAT_EARLY = .06, RHYTHM_BONUS = 1.15, ENDER_SCALING = .35;
/** Round 4b (COMBAT): a string's pop (a hop thrown by a stage before the finisher - Setsu's Snowdrift Dance, Ward's
 *  Cold Scalpel) lands its body on its feet, still in the string: reeling this long, no knockdown and no evade, so the
 *  blow after it lands whatever the rhythm. The critic: Setsu's Light x3 enders whiffed at 300 ms on the knockdown's
 *  evade, and connected at 220. */
export const POP_LAND_STUN = .32;
/** Round 4b (COMBAT): how quickly a knockdown that slides or splats (MoveDefinition.knock) bleeds off its knockback:
 *  under a blow's usual 7 a body travels a seventh of its knockback, under these about two fifths and a half. */
export const KNOCK_DRAG = { slide: 2.6, splat: 2.2 } as const;
/** Round 4b (COMBAT): how hard a knockdown's spike (MoveDefinition.knock) bounces its body back off the floor, m/s: a
 *  third of a metre and under half a second, where a juggle's ground bounce (GROUND_BOUNCE_LIFT) is a launch. */
export const SPIKE_BOUNCE = 3.4;
/** v72, the dream loop's air strike (24 October 2026): how fast a body already in the air is driven at the floor by a
 *  blow that spikes it (the outcome groundBounce: an air strike, a rush finisher's spike), m/s. It was 6: from an air
 *  string's height the body drifted down for half a second, "pinned at the contact point" to the blind critics; it
 *  should be blasted clear within a few frames. It still bounces once off the floor (GROUND_BOUNCE_LIFT). */
export const AIR_SPIKE_DRIVE = 16;
export const AIR_FLING = { hold: .1, away: 9, down: 7, drag: 1.2 } as const;
/** Round 4b (COMBAT): Jump + Light pressed as the jump leaves the floor waits this long into the jump, so the air
 *  string starts in the air rather than as a jab thrown a hand's breadth off the floor. */
export const AIR_STRING_LIFTOFF = .06;
/** What an airborne stage is announced as for the fighters whose air normals
 *  are the donated kicks (AIR_NORMAL_FIGHTERS). Stage 0 is AIR_NORMALS.light. */
export const AIR_RUSH_NAMES = ['Knee Hitch', 'Kick Loose', 'Drop Knot'] as const;
/** Round 3b (HITFEEL): the air string of each fighter lent the air kicks,
 *  in that fighter's own moves. Seven of them shared one string - Knee Hitch,
 *  Kick Loose - and one donated animation for it, which is what a blind critic
 *  read as "templated"; and the stages after the first were announced as
 *  kicks while most of them drew the fighter's grounded rush clips. Stages 1
 *  and 2 are named for what the renderer draws for them (Fighter's
 *  AIR_STRING_CLIPS): moves of the fighter's own, and names from their own
 *  series where it has one.
 *  Round 4b (COMBAT): every Vol.1 fighter's, and Jump + Light is a blow of
 *  its own. The round-4 blind critic found it the grounded jab for 11 of 12
 *  fighters - the same clip, the same segment, and the move list naming
 *  Space+J as it named J. Each stage is drawn with a clip of the fighter's
 *  own that is not the jab - a part of one of their takes the enders leave
 *  free, a stage of their own string thrown in the air, or for Gaunt and Kenzo
 *  a take made for it (scripts/combos/vol1_enders2.py) - and is announced by
 *  a name of its own where it has one (Kosho's Emince,
 *  Gummy's Spindrift Jab), otherwise a plain description of what is drawn. */
export const AIR_RUSH: Partial<Record<FighterId, readonly [string | undefined, string, string]>> = {
  chohan:["Upping the Ante","Cheap Shot","No Refunds"],
  aqrab:["Antlion Pit","Golden Pincer","Dune Shackle"],
  tsubute:["Leapfrog","Plunk","Geode"],
  ume:["Rising Magnolia","Magnolia Backfist","Shattering Blossom"],
  lanthorn:["Rising Lamplight","Wick Turn","Tavern Cleaver"],
  highsun:["Morning Ascent","Lordly Turn","Noonday Divide"],
  torsion:["Snap Twist","About-Face","Air Rebuff"],
  kubiwa:["Beckon","Hold","Diminuendo"],
  onigawara:["Rising Gore","Shoulder Reversal","Jagged Finish"],
  cardo:["Rising Unspell","Headlong Thrust","Thistledown Storm"],
  minase:["Rising Gale","Crossing Relay","Gale Descent"],
  aquilo:["Rising Swallow","Swallowtail Cross","Downdraft"],
  'psyche':['Rising Swarm','Wing Twist','Grasping Swarm'],
  'ovid':['Jackhammer Uppercut','Glass Hook','Sledgehammer'],
  rotfalke:['Rush 1','Rush 2','Rush 3'],
  bonsho:['Rising Bell Palm','Bead Turn','Bronze Breaker'],
  yodaka:['Rising Spark','Ember Turn','Watchfire Divide'],
  murex:['Spine Breaker','Twisting Claw','Core Ram'],
  kinu:['Silk Uppercut','Whip Stitch','Jailbreak Slam'],
  'madake':['Bamboo Straight','Rising Shoot','Descending Fang'],
  akayuri:['Upturned Lily','Crossing Lilies','Red Rain Descent'],
  hagure:['Turnaside Hand','Stray Cross','Howling Break'],
  hisame:['Borealis','Sleet Cut','Coup de Glace'],
  svanhild:['Reed Snare','Ripple Riposte','Highborn Tide'],
  mizuhiki:['Counter-Twist','Return Cut','Cross Splice'],
  'shibuichi':['Planish','Rising Billet','Armored Hammer'],
  'rakucho':['Torn Page','Ribbon Lash','Four Bookmarks'],
  irbis:["Claw Cross","Snow-Cat Reversal","Mauling Rake"],
  shidare:["Petal Cut","Pruning Cut","Petalstorm Finish"],
  hinomoto:["General's Cut","Pyre Reversal","Ashen Divider"],
  amagoi:["Rod Thrust","Rain Shove","Iron Rod Judgment"],
  'shakudo':["Rivet","Swage","Anvil Drop"],
  hikui:["Rising Witchfire","Turning Ember","Scorch Cross"],
  tokan:['Frostbite Cut','Sleet Heel','Floe Cleave'],
  strappado:['String Lash','Marionette Reversal','Highwire Heel'],
  unari:['Liftoff','Plummet','Nosedive'],
  barrow:['Tar Jab','Pitch Backfist','Glutton Heel'],
  sashigane:['Rising Section','Cross Section','Critical Load'],
  gosu:['Rising Seam','Porcelain Hook','Ruin Breaker'],
  kusushi:['Rising Thrust','Rib Breaker','Crushing Heel'],
  hakushi:['Mountain Palm','Lion Backhand','Pearl Drive'],
  suzuran:['Handstroke','Backswing','Full Peal'],
  wataame:['Stretch','Shrug','Go Dutch'],
  bruin:['Back-Blade Sweep','Back-Blade Thump','Deep Woods Cut'],
  senko:['Rising Beam','Prism Roundhouse','Glare Heel Drop'],
  buna:['Swathe','Snowbreak','Splitting Wedge'],
  oyashio:['Finback Rise','Swell Uppercut','Breaker Hammer'],
  adad:['Ascending Spire','Staff Reverse Quill','Bolt Downstroke'],
  akaito: ["Rising Thread","Return Cut","Falling Veil"],
  shijima: ["Rising Descant","Turning Descant","Falling Hush"],
  tempo:['Rising Beat','Body Shot','Elbow Drop'],
  tancho:['Icicle Beak','Rime Backhand','Ember Talon'],
  bellows:['Chimney Uppercut','Clinker Backfist','Steam Hammer'],
  mikage:['Rising Pounce','Velvet Elbow','Tailwhip Heel'],
  'full-beam': ['Keeper\'s Uppercut', 'Keeper\'s Backfist', 'Aerial Hammer'],
  pyroclast: ['Rising Vent', 'Spitfire Cross', 'Airburst'],
  ampere: ['Spark Uppercut', 'Live Line Cross', 'Lineman\'s Kick'],
  shanxiao: ['Rising Colossus', 'Air Backfist', 'Colossus Hammer'],
  kuzu: ['Rising Tooth', 'Air Backtooth', 'Falling Dovetail'],
  shakugo: ['Fissure Uppercut', 'Aerial Cinder Backfist', 'Slag Descent'],
  strix: ['Vigil Ascent', 'Aerial Reverse Quill', 'Descending Wing'],
  'basilissa': ['Thornrise Heel', 'Petal Air Kick', 'Crown Heel Drop'],
  sorayomi: ['Rising Vane', 'Aerial Staff Reverse Quill', 'Descending Vane'],
  taisei: ['Flying Kick', 'Ghost Step Strike', 'Wreckfall Crash'],
  ouga: ['Sky Elbow', 'Shikou Palm', 'Iron Sledge'],
  // Konta's own rig is where the air attacks came from, and his string
  // keeps its first.
  konta: ['Gust Strike', 'Twin Knee', 'Pack Flurry'],
  gummy: ['Spindrift Jab', 'Whitecap Punch', 'Breakwater Slam'],
  kosho: ['Emince', 'Fouette', 'Mille-Feuille'],
  shirokane: ['Flying Side Kick', 'Snap Kick', 'Somersault Kick'],
  // The feel pass: the third plays Rush 3's clip, re-keyed as the Hawk Combo's heel drop.
  shiden: ['Aerial Slash', 'Falling Cut', 'Rook\'s Heel'],
  kenzo: ['Eagle Swoop', 'Talon Cross', 'Dune Leap'],
  koko: ['Rivet Hook', 'Rivet Breaker', 'Falling Iron'],
  nigo: ['Aerial Cleave', 'Backhand Cleave', 'Overhead Cleave'],
  kagari: ['Rising Ember', 'Ember Hook', 'Falling Ember'],
  ward: ['Vaulting Lancet', 'Lancet Sweep', 'Lancet Drop'],
  kuon: ['Sky Hex', 'Zenith Kick', 'Gravity Dive'],
  oro: ['Midnight Straight', 'Kneel! Kneel!', 'Clockwork Kick'],
  gaunt: ['Aerial Cleave', 'Rising Swing', 'Falling Chop'],
  setsu: ['Sleet Kick', 'Snow Swipe', 'Flurry Flip'],
};
/** What an airborne rush stage of one of AIR_NORMAL_FIGHTERS is announced as,
 *  or undefined where the stage keeps its own name (see AIR_RUSH). */
export function airRushName(fighter: FighterId, stage: number): string | undefined {
  const own = AIR_RUSH[fighter];
  return own ? own[stage] : AIR_RUSH_NAMES[stage];
}
/** The roster's rush template for stages 1..3, before per-fighter tempo:
 *  one contact each, the last one the finisher. Stages 1 and 2 barely move
 *  the target, so the string stays in reach; the finisher launches them
 *  (knockback past LAUNCH_KNOCKBACK) and freezes the pair like a heavy. */
// Round 3d (PACE): from 0.55/0.22, 0.6/0.24 and 0.85/0.38 - the lights'
// cadence, the finisher still a beat heavier than the stages before it. The
// stages before it knock back at 2 (was 2.5): a quarter quicker, they carry
// the target about as far a second as they did (0.29 m a stage), and a victim
// drawn a round trip late is not left behind the next blow's fist.
const RUSH_TEMPLATE = [
  { duration: .42, contact: .16, stun: .24, knockback: 2, stamina: 4 },
  { duration: .45, contact: .17, stun: .24, knockback: 2, stamina: 4 },
  { duration: .58, contact: .22, stun: .45, knockback: 3, finisherKnockback: 9.5, stamina: 6, hitstop: HITSTOP.heavy },
] as const;
/** Round 3e (VARIETY): how a fighter's string goes. The third blind critic:
 *  "every rush string follows the same hurt, hurt, hurt, launch, launch
 *  pattern". Each shape changes what the stages after the jab do:
 *    launch   the finisher sends them up for the chase and the air string
 *             (the string as it was);
 *    juggle   the second stage pops them off their feet, and the finisher
 *             catches them in the air and keeps them there for the chase;
 *    spike    the finisher drives them into the floor: they bounce up into
 *             the chase;
 *    carry    every stage drives them back a stride, and the finisher blows
 *             them into whatever is behind them - a wall throws them back;
 *    stagger  the finisher leaves them reeling in front of you: the heavy or
 *             the special cancelled from it lands before they recover;
 *    spin     the finisher spins them round and sends them reeling aside. */
export type RushShape = 'launch' | 'juggle' | 'spike' | 'carry' | 'stagger' | 'spin';
const RUSH_SHAPES: Record<RushShape, readonly [Partial<MoveDefinition>, Partial<MoveDefinition>, Partial<MoveDefinition>]> = {
  launch: [{}, {}, { outcome: 'launch' }],
  // The pop is kept low (a 3.4 m/s hop is 0.37 m up a fifth of a second on,
  // when the finisher lands) so a grounded finisher still reaches it.
  // The finisher juggles a body already up; one still on the floor (the pop
  // was blocked, or missed) it pops itself.
  juggle: [{}, { outcome: 'hop', lift: 3.4, knockback: 1 }, { outcome: 'hop', lift: 5.5, finisherKnockback: 4 }],
  spike: [{}, {}, { outcome: 'groundBounce', finisherKnockback: 2 }],
  // A stride a stage: 4.5 m/s under the stage's drag is 0.64 m, which the
  // next stage's own step closes. The blow-back is lifted a little higher
  // than a heavy's (4.6 against 3.4), so that out in the open the light that
  // chases it still catches it in the air.
  carry: [{ knockback: 4.5 }, { knockback: 4.5 }, { outcome: 'wallBounce', lift: 4.6, finisherKnockback: 11 }],
  stagger: [{}, {}, { outcome: 'stagger', stun: .62, finisherKnockback: 2.5 }],
  spin: [{}, {}, { outcome: 'spin', stun: .6, finisherKnockback: 3.5 }],
};
export interface RushSpec {
  /** Stage names, as the cast event announces them and the HUD flashes them. */
  names: readonly [string, string, string];
  damage: readonly [number, number, number];
  /** Scales the template's durations and contacts: under 1 is quicker. */
  tempo?: number;
  /** Round 3e (VARIETY): how the string goes (RUSH_SHAPES). */
  shape: RushShape;
  /** Reach and step for a fighter whose light is not a melee blow. */
  melee?: Pick<MoveDefinition, 'range' | 'radius' | 'lunge'>;
  /** Explicit native stages for a ranged string; each still requires a manual input. */
  stages?: readonly Partial<MoveDefinition>[];
}
/** Per-fighter rush strings. Names come from each fighter's own series where
 *  it has them; reach, radius and step are the light's, so a stage connects
 *  from where the light does and an armed fighter still reaches further.
 *  Round 3e (VARIETY): the tempo spans 0.8 (Setsu) to 1.25 (Gaunt), from
 *  0.85-1.2, and each string has its shape. */
const RUSH_SPECS: Record<FighterId, RushSpec> = {
  chohan:{names:['Hustle Cut','Reshuffle','Jackpot Edge'],damage:[24,31,48],tempo:.95,shape:'carry'},
  aqrab:{"names":["Antlion Pit","Golden Pincer","Dune Shackle"],"damage":[25,27,49],"tempo":1.02,"shape":"carry"},
  tsubute:{"names":["Slate","Geode","Handful"],"damage":[22,26,43],"tempo":1,"shape":"stagger","stages":[{"duration":0.6,"cooldown":0.6,"contacts":[0.26],"style":"projectile","speed":34,"range":12,"lunge":0,"aimOnRelease":true},{"duration":0.7,"cooldown":0.7,"contacts":[0.32],"style":"projectile","speed":34,"range":12,"lunge":0,"aimOnRelease":true},{"duration":0.68,"cooldown":0.68,"contacts":[0.3],"style":"projectile","speed":34,"range":12,"lunge":0,"aimOnRelease":true}]},
  ume:{names:["Budburst Straight","Magnolia Backfist","Budburst Drive"],damage:[23,26,47],tempo:1,shape:'carry'},
  lanthorn:{names:['Wick Cut','Reverse Wick','Backdraft'],damage:[25,27,48],tempo:1,shape:'carry'},
  highsun:{names:['Sunbeam Sweep','Lordly Turn','Twelve O\'Clock'],damage:[27,29,50],tempo:1,shape:'carry'},
  torsion:{names:['Snap Twist','About-Face','Squeeze'],damage:[24,27,47],tempo:1,shape:'carry'},
  kubiwa:{names:['Baton Flick','Beckon','Hold'],damage:[24,27,46],tempo:1,shape:'carry'},
  onigawara:{names:['Notched Cleave','Brute Reversal','Gore Execution'],damage:[25,29,50],tempo:1,shape:'carry'},
  cardo:{names:['Hack','Hack Back','Unspell Crash'],damage:[25,29,50],tempo:1,shape:'carry'},
  minase:{names:['Relay Knife','Rising Gale','Gale Palm'],damage:[22,27,47],tempo:1,shape:'carry'},
  aquilo:{names:['Swallow Darts','Rising Swallow','Forktail Gust'],damage:[22,27,47],tempo:1,shape:'carry'},
  'psyche':{names:['Moth Palm','Wingbeat','Dusting Wings'],damage:[24,33,48],tempo:1,shape:'carry'},
  'ovid':{names:['Cracked Knuckle','Glass Hook','Jackhammer Uppercut'],damage:[27,36,49],tempo:1,shape:'carry'},
  hawser:HAWSER_RUSH,
  rotfalke:{names:['Feather Knife','Raking Talon','Stoop Breach'],damage:[25,35,48],tempo:1,shape:'carry'},
  bonsho:{names:['Dawn Bell Palm','Bead Turn','Bell-Log Elbow'],damage:[22,32,45],tempo:1,shape:'carry'},
  yodaka:{names:['Ember Turn','Rising Spark','Watchfire Divide'],damage:[26,33,47],tempo:1,shape:'carry'},
  murex:{names:['Hooked Claw','Hooked Cross','Armored Hammer'],damage:[24,34,48],tempo:1,shape:'carry'},
  kinu:{names:['Silk Knuckle','Stitch Cross','Stone Breaker'],damage:[24,30,48],tempo:1,shape:'carry'},
  'madake':{names:['Bamboo Straight','Sprouting Backfist','Green Gale Kick'],damage:[24,34,48],tempo:1,shape:'carry'},
  akayuri:{names:['Lily Cut','Farewell Turn','Far Shore Thrust'],damage:[24,34,48],tempo:1,shape:'carry'},
  hagure:{names:['Snap Bite','Mauling Palm','Howling Spin'],damage:[25,33,47],tempo:1,shape:'carry'},
  hisame:{names:['Sleet Cut','False Edge','Coup de Glace'],damage:[25,32,46],tempo:1,shape:'carry'},
  svanhild:{names:['Ripple Riposte','Quill Return','Highborn Tide'],damage:[25,32,46],tempo:1,shape:'carry'},
  mizuhiki:{names:['Vaulting Strand','Backtwist','Shears'],damage:[26,33,47],tempo:1,shape:'carry'},
  'shibuichi':{names:['Planish','Backhand Peen','Heel Set'],damage:[27,34,49],tempo:1,shape:'carry'},
  'rakucho':{names:['Ribbon Hook','Silverfish Cross','Shredded Chapter'],damage:[24,32,48],tempo:1,shape:'carry'},
  irbis:{names:['Rising Barb','Snow-Cat Reversal','Predator Breaker'],damage:[24,31,47],tempo:1,shape:'carry'},
  shidare:{names:['Rising Petals','Crossing Petals','Petal Descent'],damage:[23,31,47],tempo:1,shape:'carry'},
  hinomoto:{names:['Ember Stroke','Rising Spark','Ashen Divider'],damage:[25,32,49],tempo:1,shape:'carry'},
  amagoi:{names:['Rainrod Thrust','Rain Rebuff','Iron Rod Judgment'],damage:[26,31,47],tempo:1,shape:'carry'},
  'shakudo':{names:['Rivet','Upset','Drop Forge'],damage:[27,31,49],tempo:1,shape:'carry'},
  hikui:{names:["Shadow Cut","Recoil Cut","Scorch Slash"],damage:[23,26,47],tempo:1,shape:'carry'},
  tokan:{names:['Frost Cut','Sleet Heel','Floe Cleave'],damage:[24,26,48],tempo:1,shape:'carry'},
  strappado:{names:['String Rake','Marionette Cut','Spotlight Slash'],damage:[24,26,48],tempo:1,shape:'carry'},
  unari:{names:['Tug','Loop','Payout'],damage:[24,26,48],tempo:1,shape:'carry'},
  barrow:{names:['Pitch Jab','Stolen Tremor','Glutton Hammer'],damage:[24,26,48],tempo:1,shape:'carry'},
  sashigane:{names:['Cross Section','Rising Section','Critical Load'],damage:[24,26,48],tempo:1,shape:'carry'},
  gosu:{names:['Kin!','Kin Kin!','Porcelain Hammer'],damage:[24,26,48],tempo:1,shape:'carry'},
  kusushi:{names:['Rib Breaker','Rising Thrust','Crushing Heel'],damage:[23,25,48],tempo:1,shape:'carry'},
  hakushi:{names:['Lion Backhand','Mountain Palm','Pearl Drive'],damage:[23,25,48],tempo:1,shape:'carry'},
  suzuran:{names:['Handstroke','Backswing','Full Peal'],damage:[21,23,44],tempo:.94,shape:'carry'},
  wataame:{names:['Shrug','Stretch','Go Dutch'],damage:[24,26,49],tempo:1,shape:'carry'},
  bruin:{names:['Back-Blade Thump','Back-Blade Sweep','Deep Woods Cut'],damage:[24,26,49],tempo:1,shape:'carry'},
  senko:{names:['Beacon Kick','Prism Roundhouse','Glare Heel Drop'],damage:[23,25,47],tempo:1,shape:'carry'},
  buna:{names:['Snowbreak','Uproot','Chopping Block'],damage:[25,27,50],tempo:1.08,shape:'carry'},
  oyashio:{names:['Swell Uppercut','Finback Rise','Breaker Hammer'],damage:[24,26,48],tempo:1.08,shape:'carry'},
  adad:{names:['Glass Backcut','Rising Spire','Staff Breaker'],damage:[23,25,47],tempo:1.02,shape:'carry'},
  akaito: {names:["Rising Thread","Return Cut","Falling Veil"],damage:[22,24,46],tempo:1,shape:'carry'},
  shijima: {names:["Rising Descant","Turning Descant","Falling Hush"],damage:[22,24,46],tempo:1,shape:'carry'},
  tempo:{names:['Double-Tap Cross','Rising Beat','Elbow Drop'],damage:[22,24,46],tempo:.95,shape:'carry'},
  tancho: { names: ['Rime Backhand','Icicle Beak','Ember Talon'], damage:[23,25,47],tempo:1,shape:'carry' },
  bellows: { names: ['Clinker Backfist','Chimney Uppercut','Steam Hammer'],damage:[24,26,48],tempo:1.08,shape:'carry' },
  mikage: { names: ['Velvet Elbow','Rising Pounce','Tailwhip Heel'],damage:[22,24,46],tempo:.9,shape:'carry' },
  'full-beam': { names: ['Keeper\'s Cross', 'Keeper\'s Uppercut', 'Anchor Hammer'], damage: [25, 27, 50], tempo: 1, shape: 'carry' },
  pyroclast: { names: ['Spitfire Cross', 'Rising Vent', 'Magma Cannon'], damage: [23, 25, 48], tempo: 1, shape: 'carry' },
  ampere: { names: ['Live Line Cross', 'Spark Uppercut', 'Good Hope Drop'], damage: [22, 24, 46], tempo: .98, shape: 'carry' },
  shanxiao: { names: ['Wild Cross', 'Mauler Backfist', 'Colossus Hammer'], damage: [24, 26, 48], tempo: 1.12, shape: 'carry' },
  kuzu: { names: ['Backtooth Swipe', 'Rising Tooth', 'Dovetail Drop'], damage: [22, 24, 47], tempo: 1, shape: 'carry' },
  shakugo: { names: ['Slag Hook', 'Cinder Backfist', 'Verdict Hammer'], damage: [23, 25, 48], tempo: 1.08, shape: 'carry' },
  strix: { names: ['Vigil Return', 'Rising Wing', 'Graveward Stroke'], damage: [21, 23, 47], tempo: 1.08, shape: 'carry' },
  'basilissa': { names: ['Thorn Sweep', 'Thorn Reverse Heel', 'Crown Heel Drop'], damage: [20, 22, 45], tempo: 1.08, shape: 'carry' },
  sorayomi: { names: ['Vane Backcut', 'Staff Whirl', 'Downpour Stroke'], damage: [20, 22, 44], tempo: 1.08, shape: 'carry' },
  // Round 3: back on the roster's numbers. The stages were cut to 24/26/50
  // because Meteor Combination realised only 71; Cloudstep lands 90.
  // Round 3e: the balanced one keeps the classic string - launch and chase.
  taisei: { names: ['Chain Jab', 'Riot Palm', 'Skyfall Smash'], damage: [17, 18, 49], tempo: .9, shape: 'launch' },
  // Round 3: the light is his fist now (the Crown Straight), so the
  // stages take its reach, radius and step like everyone else's.
  // Round 3e: the Double Axe Handle spikes them into the floor.
  ouga: { names: ['Royal Knee', 'Crown Elbow', 'Double Axe Handle'], damage: [19, 21, 45], tempo: 1.05, shape: 'spike' },
  konta: { names: ['Twin Clone Jab', 'Twin Clone Upper', 'Up You Go!!'], damage: [17, 18, 54], tempo: .95, shape: 'launch' },
  // Round 3e: the Hawk Combo's heel drop spikes them into the floor.
  shiden: { names: ['Habakiri Thrust', 'Falling Ash Shadow', 'Hawk Combo'], damage: [18, 20, 43], tempo: .92, shape: 'spike' },
  // Round 3e: the Static Kick leaves them reeling for the Sickle Bolt.
  shirokane: { names: ['Kunai Slash', 'Ash Hurricane', 'Static Kick'], damage: [17, 19, 45], tempo: .92, shape: 'stagger' },
  // Round 3e: the Whip and the Stamp drive them back; the Rifle's twist
  // blows them into the wall.
  gummy: { names: ['Crosswind Kick', 'Ricochet Punch', 'Riptide Fist'], damage: [17, 19, 44], tempo: .95, shape: 'carry' },
  // Round 3e: three swords walking them back at blade's length.
  kenzo: { names: ['Jackal Rend', 'Sidewinder', 'Dust Devil'], damage: [20, 22, 46], shape: 'carry' },
  // Round 3e: the Brunoise pops them up and the Flambe Kick keeps them
  // there - the quickest string after Setsu's, and the lightest.
  kosho: { names: ['Julienne', 'Brunoise', 'Flambe Kick'], damage: [16, 17, 38], tempo: .84, shape: 'juggle' },
  // Round 3e: the GAAAN!! leaves them reeling in front of Iron Spirit - a
  // slower, harder string for the GAN to follow.
  koko: { names: ['Gan!', 'Gan Gan!!', 'GAAAN!!'], damage: [23, 25, 44], tempo: 1.12, shape: 'stagger' },
  nigo: { names: ['Haizan Slash', 'Haizan Sweep', 'Point-Blank Scorch'], damage: [20, 22, 44], tempo: 1.05, shape: 'carry' },
  kagari: { names: ['Ember Jab', 'Cinder Kick', 'Rekka'], damage: [19, 20, 43], shape: 'launch' },
  // Round 3e: Tact lifts them off their feet and keeps them up.
  ward: { names: ['Triage Cut', 'Cold Scalpel', 'Gurney Lift'], damage: [19, 21, 43], shape: 'juggle' },
  // Round 3e: Nova is a repulsion - blown back into the wall.
  kuon: { names: ['Hex Jab', 'Hex Kick', 'Nova'], damage: [19, 20, 41], shape: 'carry' },
  // Round 3e: KYAHAAA!! spins them round.
  oro: { names: ['Noroma!!', 'Noroma Noroma!!', 'KYAHAAA!!'], damage: [18, 20, 37], tempo: .92, shape: 'spin' },
  // A sword taller than he is: the slowest string, as his light is the slowest jab.
  // Round 3e: and the Slab Smash drives them into the floor.
  gaunt: { names: ['Backhand Hack', 'Rising Hack', 'Slab Smash'], damage: [27, 30, 52], tempo: 1.25, shape: 'spike' },
  // The quickest normals in the roster, and so the quickest string.
  // Round 3e: Snowdrift Dance pops them up and the Hailstone Palm keeps them up.
  setsu: { names: ['Frost Claw', 'Snowdrift Dance', 'Hailstone Palm'], damage: [15, 16, 36], tempo: .8, shape: 'juggle' },
  // The shop's fighters. Gorai's ends in the mast-breaker coming down - into the
  // floor; Haldor's drives them back to the wall; Sorrel' and Dorado's lift them.
  gorai: { names: ['Spar Backswing', 'Cask Bash', 'Mast Slam'], damage: [26, 29, 50], tempo: 1.2, shape: 'spike' },
  haldor: { names: ['Glaive Sweep', 'Rising Reap', 'Tremor Palm'], damage: [26, 29, 50], tempo: 1.2, shape: 'carry' },
  sorrel: { names: ['Red Pressure', 'Coat Turn', 'Rising Wake'], damage: [19, 21, 43], shape: 'launch' },
  // Dorado's: the overhead cut, Kagari back across, and the rising spin that lifts them.
  dorado: { names: ['Gold Cleave', 'Backhand Return', 'Corsair Gale'], damage: [20, 22, 44], shape: 'launch' },
  // Shiun's: a turn of the palm, the flash step through them, and the wings
  // spreading as he rises - up off the floor, and kept there.
  shiun: { names: ['Presence Turn', 'Cinder Step', 'Relic Rise'], damage: [18, 20, 41], shape: 'juggle' },
  // Magatsu's: a slash, a claw, and the uppercut that throws them up.
  magatsu: { names: ['Hex Slash', 'Hex Claw', 'Hex Rise'], damage: [19, 21, 42], shape: 'launch' },
  // Vesper's: a slash, the reverse-quill, and the rising cut that pops them up - a fencer's, a touch quicker than the
  // roster's swords - and keeps them there.
  vesper: { names: ['Feather Slash', 'Reverse Quill', 'Updraft'], damage: [18, 20, 41], tempo: .95, shape: 'juggle' },
  // Imago's: a jab, a hook kick, and the rising talon that leaves them reeling in front of him - quick, as the
  // King is.
  imago: { names: ['Chitin Jab', 'Mantis Hook', 'Rising Barb'], damage: [18, 20, 42], tempo: .9, shape: 'stagger' },
  // Wuming's: the rush's second, third and fifth blows - the last throws them up.
  'wuming': { names: ['Dusk Rush', 'Dusk Spin Kick', 'Dusk Smash'], damage: [18, 20, 42], tempo: .9, shape: 'launch' },
  // Jirenga's: the hook, the flurry, and the spinning heel brought down into the floor - heavier and a touch slower.
  jirenga: { names: ['Bedrock Hook', 'Guardian Flurry', 'Crushing Heel'], damage: [20, 22, 44], tempo: 1.05, shape: 'spike' },
  // Emperor Jinlin's: his tail across them, the finger driven in, and the tail swept round that drives them back.
  'jinlin': { names: ['Scale Swipe', 'Pearl Thrust', 'Tail Sweep'], damage: [17, 19, 40], tempo: .9, shape: 'carry' },
  // Gohaku: a jab, the flying kick, and both fists brought down over his head into the floor.
  'gohaku': { names: ['Long-Arm Jab', 'Flying Kick', 'Mountain Hammer'], damage: [18, 20, 42], tempo: .95, shape: 'spike' },
  // Ippon: a jab, a hook, and the knee into a kick that sends them away.
  ippon: { names: ['Clock-In Jab', 'Clock-In Hook', 'Clock-In Kick'], damage: [19, 21, 42], tempo: 1, shape: 'carry' },
  // Sekka: a jab, the Sleet Kick, and the axe kick brought down through them (Icefall Hammer). Quick.
  sekka: { names: ['Shatter Jab', 'Sleet Kick', 'Icefall Hammer'], damage: [18, 20, 42], tempo: .9, shape: 'spike' },
  // Tobari: a cut of the kunai, the flying kick, and the rising blow that lifts them.
  tobari: { names: ['Quill Slice', 'Shadow Kick', 'Rookwing Rise'], damage: [17, 19, 41], tempo: .92, shape: 'launch' },
  // Akagane: a jab, a kick, and the rising blow; Asahi: a cut, a chop, the rising slash; Levin: the reverse-quill, a kick and
  // the rising blade; Rook: a dagger cut, a kick and the rising blow.
  akagane: { names: ['Warlord Jab', 'Warlord Kick', 'Warlord Rise'], damage: [18, 20, 42], tempo: .92, shape: 'launch' },
  asahi: { names: ['Ash Cut', 'Ember Chop', 'Rising Slash'], damage: [17, 20, 42], tempo: .95, shape: 'launch' },
  levin: { names: ['Nick', 'Heel Tap', 'Lift Off'], damage: [18, 19, 42], tempo: 1, shape: 'launch' },
  'rook': { names: ['Shadow Cut', 'Shadow Kick', 'Raven Rise'], damage: [18, 20, 41], tempo: .95, shape: 'launch' },
  // Gaku: the jab, the kick and the rising paw.
  gaku: { names: ['Cub Jab', 'Scav Kick', 'Rising Paw'], damage: [18, 20, 41], tempo: .95, shape: 'launch' },
};
/** Round 3e (VARIETY): which way each fighter's string goes. */
export const RUSH_SHAPE: Record<FighterId, RushShape> =
  Object.fromEntries(Object.entries(RUSH_SPECS).map(([fighter, spec]) => [fighter, spec.shape])) as Record<FighterId, RushShape>;
const hundredths = (value: number) => Math.round(value * 100) / 100;
/** A light string's stages 1..3 from its spec and the light it follows (a fighter's own: RUSH; a form's with a kit of its
 *  own: awakening.ts). */
export function rushStagesOf(spec: RushSpec, light: MoveDefinition): readonly MoveDefinition[] {
  const tempo = spec.tempo ?? 1;
  return RUSH_TEMPLATE.map((stage, i): MoveDefinition => ({
    name: spec.names[i], duration: hundredths(stage.duration * tempo), contacts: [hundredths(stage.contact * tempo)],
    damage: spec.damage[i], range: spec.melee?.range ?? light.range, radius: spec.melee?.radius ?? light.radius,
    stamina: stage.stamina,
    // A continued stage waives its cooldown, so this is only what the next
    // fresh jab waits for: the stage's own length, so a light pressed into
    // the finisher comes out as it ends - the cadence a light has today.
    cooldown: hundredths(stage.duration * tempo), stun: stage.stun, knockback: stage.knockback,
    ...('finisherKnockback' in stage ? { finisherKnockback: stage.finisherKnockback, hitstop: stage.hitstop } : {}),
    lunge: spec.melee ? spec.melee.lunge : light.lunge, style: 'melee',
    // (A light that brings its own reach lands its stages from it: MoveDefinition.reach.)
    ...(light.reach !== undefined && !spec.melee ? { reach: light.reach } : {}),
    ...RUSH_SHAPES[spec.shape][i],
    ...spec.stages?.[i],
  }));
}
const rushStages = (fighter: FighterId) => rushStagesOf(RUSH_SPECS[fighter], MOVES[fighter].light);
/** Rush stages 1..RUSH_STAGES-1 per fighter; stage 0 is MOVES[id].light.
 *  Read them through rushMove (awakening.ts), which applies the awakened forms. */
export const RUSH: Record<FighterId, readonly MoveDefinition[]> =
  Object.fromEntries((Object.keys(MOVES) as FighterId[]).map(fighter => [fighter, rushStages(fighter)])) as Record<FighterId, readonly MoveDefinition[]>;

export const HOUSE_APPLIED: readonly string[] = applyHouseKits(MOVES, TIME_STOP_TOURS);

/** Vanish. A just guard against a melee blow does not only hold the attacker
 *  where they stand: the defender steps out of the swing and reappears behind
 *  them, facing their back: that is what a parry is here. Every
 *  parry benefit stays (attacker cancelled and held, meter). Not against
 *  projectiles or beams - there is nobody's back to step behind. Cooldown
 *  rather than stamina: the parry's contract is no chip and no stamina, and
 *  the cooldown is what stops two fighters vanishing round each other.
 *  VANISH_ON_JUST_GUARD switches the whole thing off. */
export const VANISH_ON_JUST_GUARD = true;
/** Metres behind the attacker, along the swing, centre to centre. */
export const VANISH_BEHIND = 1.25;
export const VANISH_COOLDOWN = 1.5;
/** A beat of evade across the step, so a second blow in the same tick does
 *  not land on the afterimage. */
export const VANISH_EVADE = .2;
/** The attacker stumbles into the space the defender left, instead of being
 *  shoved back into the body now standing behind them. */
export const VANISH_STUMBLE = 2.5;
/** How long after a vanish the defender keeps facing the attacker's back and
 *  aims a melee swing at it whatever the camera is doing: the punish is the
 *  point, and the view still swinging round to find it should not decide it. */
export const VANISH_AIM = .6;
/** Chase. A dash pressed within this long of your own hit launching or
 *  knocking somebody away homes on them in three dimensions, from the ground
 *  as well as from the air, and arrives at striking distance from where they
 *  will be rather than where they were. It extends the air homing dash. */
export const CHASE_WINDOW = .7;
export const CHASE_SECONDS = .26;
/** A chase further than this is a dash: a launch across the room is not
 *  followed through a wall of people. */
export const CHASE_RANGE = 9;
export const CHASE_MAX_SPEED = 30;
/** What the chase hands back at the end, in m/s along its line: enough to
 *  keep drifting into the follow-up, not enough to fly past the target. */
export const CHASE_EXIT = 2;
/** The chase on the light button. A light pressed within this long
 *  of your own rush finisher or heavy sending somebody flying (counted, like
 *  CHASE_WINDOW, after your own impact freeze) is the chase itself - the same
 *  homing dash a dash press makes, for a dash's stamina - and the press is
 *  held for its arrival, where it comes out as the air light. So mashing
 *  light plays launch, chase, air hits. A dash press still chases on its own. */
export const LIGHT_CHASE_WINDOW = .5;
/** While the body your own launch sent up is still in the air within this
 *  many metres, a light that would start a fresh string on the ground - under
 *  them, at nothing - is held instead of thrown. It comes out once they are
 *  down, or it is dropped when its buffer runs out. */
export const LAUNCH_HOLD_RANGE = 6;
/** The early charge of a charge-in move (MoveDefinition.chargeIn): the slide
 *  back that opens the gap is over by this far into the cast, or by the time
 *  the move's approach starts driving in, whichever is sooner. */
export const CHARGE_BACKSTEP_UNTIL = .3;
/** A charge-in whose approach is a drive (the drive fighters' authored
 *  lunges) drives only through the last this-many seconds before its blow,
 *  and at the speed that arrives on it rather than at its authored lunge -
 *  which crossed the gap a fifth of a second early and then held the charge
 *  accent until the contact came. */
export const CHARGE_DRIVE = .35;
/** Round 3d (PACE): and never so late that the slide back before it has less
 *  than this. The slide is an eased half-sine; opening 0.8 m inside a fifth of
 *  a second is a run's own start (GROUND_ACCEL), and once the heavies landed
 *  at 0.42-0.44 s the drive's usual share of the wind-up left it 0.15 s. */
export const CHARGE_SLIDE = .22;
/** An iai dash (MoveDefinition.dashThrough) starts this long before its
 *  contact and arrives on it, stopping DASH_THROUGH_PAST beyond the centre of
 *  the body it was aimed at. It goes no further than DASH_THROUGH_REACH; with
 *  nobody in reach it covers DASH_THROUGH_MISS straight ahead. */
export const DASH_THROUGH_LEAD = .15;
export const DASH_THROUGH_PAST = 1.4;
/** The dash runs past the target's shoulder rather than through their chest:
 *  its line passes this far to the thrower's right of the target's centre. */
export const DASH_THROUGH_SIDE = .55;
export const DASH_THROUGH_REACH = 5;
export const DASH_THROUGH_MISS = 2.6;
export const DASH_THROUGH_MAX_SPEED = 30;
/** How fast a move with `spacing` eases bodies back out to it, m/s. */
export const SPACING_PUSH = 6;
/** However hard two bodies are driven together - a chase arriving, a juggle,
 *  a wall behind one of them - their centres never finish a tick closer than
 *  this while their heights overlap. Two bodies touch at 0.9 m. */
export const HARD_GAP = .9;
/** Damage scaling across a string: the n-th contact taken without 1.2 s of
 *  quiet is worth this much of its authored figure. Every contact counts, and
 *  the breaker does not reset it - it is a defensive escape, and it used to
 *  hand the attacker a fresh 1.0x for the trouble of being escaped from, which
 *  also made the floor unreachable by anything but a barrage. */
export const SCALING_STEP = .09, SCALING_FLOOR = .35;
export function damageScale(contact: number) {
  return Math.max(SCALING_FLOOR, 1 - (contact - 1) * SCALING_STEP);
}
/** Round 3d (PACE): an attack, and a chase, is never refused for stamina.
 *  It still spends what the bar has - down to nothing - so an empty bar
 *  costs a fighter their dash, their guard and their air recovery, never
 *  their moves. With the quicker moves a mashed string used to run the bar
 *  dry in two cycles, and every press after that was a NO STAMINA notice
 *  instead of an attack (the critics saw it spamming). */
export const STAMINA_OVERDRAW = true;
export const COMBO_STAMINA = 225;
export const STAMINA_REGEN = 32;
export const KO_HEAL = .2;
/** Air recovery costs this much stamina and is refused this soon after the hit. */
export const TECH_STAMINA = 15;
export const TECH_DELAY = .22;

/** Air combat. A cast that starts airborne falls at a fraction of gravity, so a
 *  move finishes in the air instead of dropping through itself; a hit on someone
 *  already airborne lifts them again, by less each time, so a juggle ends. */
export const AIR_CAST_GRAVITY = .45;
/** A ground smash (MoveDefinition.plunge) hangs this long at the top before it drops, and gives up waiting for the
 *  floor after PLUNGE_LIMIT: its blow lands where it is.
 *  Round 4b (JUMP): from the new heights the hang is a beat longer (.12 to .15 s) - the pose read at the top - and
 *  brakes what is left of the climb at PLUNGE_BRAKE (1/s) instead of stopping a twenty-metre-a-second rise dead; the
 *  drop reaches its speed over PLUNGE_SNAP (s) rather than in one tick. */
export const PLUNGE_HANG = .15, PLUNGE_LIMIT = 1.6, PLUNGE_BRAKE = 28, PLUNGE_SNAP = .06;
/** Round 4b (JUMP): a ground smash that dropped this far (m) - from a full jump, not a hop - lands as a launch does
 *  (the 'land' event: the floor's impact, and the drop it carries). */
export const PLUNGE_IMPACT_DROP = 3;
/** A launched fighter hangs. Arcade gravity gives a heavy launch two thirds of
 *  a second of airtime, which is not long enough for a human to see the launch,
 *  jump and reach them - the juggle existed but nobody could use it. */
export const LAUNCH_GRAVITY = .68;
/** v70, the dream loop's throw (23 October 2026): a true launch (outcome `launch`) throws its body ahead of the arc it
 *  always had and lets it back onto that arc at the top. Over its rise it runs LAUNCH_LEAD x lift x rise x s(u) above
 *  the arc, u its share of the rise and s(u) = u(1 - u)^3 - nought as it leaves, level and nought again at the top -
 *  so it leaves 1 + LAUNCH_LEAD times as fast, rises the whole way (the shape keeps the rise going for a lead up to
 *  1.78; u(1 - u)^2 sagged before the top past 0.5) and is back on the arc on the tick it tops out. Its top, its fall
 *  and its landing are the arc's, to the tick, for every lift; only how fast it gets up there changes. Taisei's
 *  launcher: 0.86 m up 50 ms after it leaves the floor (0.41 before), two thirds of the way up in a fifth of a second,
 *  then the long float to the top the chase meets it at. The blind critics wanted the victim "thrown clear within two
 *  frames"; ours "rises about one body height, slowly". */
export const LAUNCH_LEAD = 1.4;
/** The lead's shape over the rise (see LAUNCH_LEAD): u(1 - u)^3 for u in 0..1. */
export function launchLead(u: number) { const c = Math.min(1, Math.max(0, u)), r = 1 - c; return c * r * r * r; }
export const STRING_SHOVE = .62, STRING_DRAG = 14;
/** A jump comes down faster than it went up. Gravity was symmetric, so every
 *  jump was one 1.68 m, 0.77 s arc with the same float on the way down as the
 *  way up - which is what reads as a moon jump. Only a fighter who JUMPED
 *  falls at this: a launch keeps LAUNCH_GRAVITY, an air cast keeps
 *  AIR_CAST_GRAVITY, and a reaction or a splat is not a jump.
 *  Round 4b (JUMP): 1.7 to 3.3 with the jump three times the height - the strong
 *  fall of the arc below (jumpGravity). */
export const FALL_GRAVITY = 3.3;
/** The short hop. A jump whose button is up once it is JUMP_CUT_AFTER old
 *  rises under JUMP_CUT_GRAVITY instead: a tap is a hop over a low attack
 *  rather than a commitment to the air. The delay is there because the client
 *  sends inputs at thirty a second, so a tap can arrive as a jump with the
 *  button already up; seventy milliseconds is two of them.
 *  Round 4b (JUMP): 4.5 to 10 against the new jump's rise. A tap reaches about
 *  half the held jump (2.0-2.6 m, against 0.81 before; the old hop was half of
 *  the old 1.61), and the cut ends on the top of its arc rather than through it
 *  (see the simulation), so every hop gets the same half of the hang. */
export const JUMP_CUT_GRAVITY = 10, JUMP_CUT_AFTER = .07;
export const JUMP_RISE_GRAVITY = 2.3;
export const JUMP_HANG_SPEED = 1.8, JUMP_HANG_GRAVITY = 1;
/** How high and how far each fighter jumps against the old jump, by build and by
 *  how they move in their series:
 *  - 3.5x, the acrobats: Setsu (SETSUNA, an assassin's footwork), Levin (the
 *    Grapple Rig's flyer, the most airborne fighter in his series), Gaku (a wild
 *    child's spring, the three-hand leap);
 *  - 3.4x, the light and quick: Kosho (Sky Walk), Konta and Shiden (ninja who
 *    fight from the rooftops), Gummy (rubber: a stretched spring);
 *  - 3.3x, the light swordsmen and speedsters: Shirokane, Sekka, Asahi (Water
 *    Breathing's leaps), Rook;
 *  - 3.0-3.1x, the bulk of the roster: Taisei and Ouga, Nigo (ASHSTEP), Vesper,
 *    Tobari a touch over; Kenzo, Kagari, Sorrel, Kuon, LORD ORO, Wuming, Emperor Jinlin,
 *    Gohaku, Ippon at three; Ward, Dorado a touch under;
 *  - 2.8x, the stocky: KoKo, who stands and lets the spirit move;
 *  - toward 2.5x, the big and the heavy, who do not leap about: Gorai (a giant)
 *    and Haldor 2.5, Gaunt (armour and a slab of iron) and Jirenga 2.6, Imago
 *    and Akagane 2.7, Magatsu and Shiun 2.75 - the imposing ones walk. */
export const JUMP_SCALE: Record<FighterId, number> = {
  chohan:3.4,
  aqrab:3.0,
  tsubute:3.2,
  yodaka:3.1,ume:3.0,lanthorn:3.05,highsun:2.75,torsion:3.1,kubiwa:3.0,onigawara:2.7,cardo:2.7,minase:3.4,aquilo:3.4,'psyche':3.1,'ovid':2.8,hawser:3.2,rotfalke:3.1,bonsho:3.3,murex:3.1,kinu:3.15,'madake':3.4,akayuri:3.2,hagure:3.2,hisame:3.1,svanhild:3.1,mizuhiki:3.2,'shibuichi':2.8,'rakucho':3.15,irbis:3.1,shidare:3.1,hinomoto:2.65,amagoi:2.95,'shakudo':3.2,hikui:3.1,tokan:2.95,strappado:3.15,unari:3.25,barrow:2.85,sashigane:3.1,gosu:3.1,kusushi:3.0,hakushi:3.0,suzuran:3.25,wataame:3.0,bruin:3.0,
  senko:3,buna:2.8,
  oyashio:2.7,adad:3,
  akaito: 3.1,
  shijima: 3.1,
  tempo:3,
  tancho: 3, bellows: 2.7, mikage: 3.4,
  'full-beam': 3.1,
  pyroclast: 3.3,
  ampere: 3.4,
  shanxiao: 2.7,
  kuzu: 3,
  shakugo: 3,
  strix: 2.9,
  'basilissa': 2.9,
  sorayomi: 2.9,
  setsu: 3.5, levin: 3.5, gaku: 3.5,
  kosho: 3.4, konta: 3.4, shiden: 3.4, gummy: 3.4,
  shirokane: 3.3, sekka: 3.3, asahi: 3.3, 'rook': 3.3,
  taisei: 3.1, nigo: 3.1, vesper: 3.1, tobari: 3.1,
  ouga: 3, kenzo: 3, kagari: 3, sorrel: 3, kuon: 3, oro: 3, 'wuming': 3, 'jinlin': 3, 'gohaku': 3, ippon: 3,
  ward: 2.9, dorado: 2.9,
  koko: 2.8,
  magatsu: 2.75, shiun: 2.75, imago: 2.7, akagane: 2.7, gaunt: 2.6, jirenga: 2.6, gorai: 2.5, haldor: 2.5,
};
/** The gravity a body off the floor by its own jump falls under, as a multiple of
 *  the simulation's 23 m/s^2 (`cut`: the short hop's rise, button up). The
 *  simulation and jumpArc both read this, so the table's heights are the ones
 *  played. */
export function jumpGravity(vy: number, cut: boolean) {
  return cut && vy > 0 ? JUMP_CUT_GRAVITY : Math.abs(vy) <= JUMP_HANG_SPEED ? JUMP_HANG_GRAVITY : vy > 0 ? JUMP_RISE_GRAVITY : FALL_GRAVITY;
}
/** One jump stepped exactly as the simulation steps it, on a flat floor, held all
 *  the way: its highest point and the ticks it spends off the floor. */
function flight(speed: number, gravity: (vy: number) => number) {
  // The simulation's own step (SIMULATION_HZ, which is declared further down and
  // is not there yet while this module is still being evaluated).
  const dt = 1 / 60;
  let vy = speed, y = 0, apex = 0, ticks = 0, top = 0;
  while (ticks < 600) {
    vy -= 23 * dt * gravity(vy); y += vy * dt; ticks++;
    if (y > apex) { apex = y; top = ticks; }
    if (vy <= 0 && y <= .03) break;
  }
  return { apex, ticks, top };
}
/** The jump everybody had before round 4b, stepped the same way: 8.8 m/s under
 *  plain gravity up and 1.7x down. 1.61 m, 40 ticks, and at the 7.5 m/s run
 *  5.0 m of floor. */
const BEFORE = flight(8.8, vy => vy < 0 ? 1.7 : 1);
export const JUMP_BEFORE = { apex: BEFORE.apex, air: BEFORE.ticks / 60, carry: 7.5 * BEFORE.ticks / 60 };
const arcs = new Map<FighterId, { speed: number; leap: number; apex: number; air: number; rise: number }>();
/** A fighter's jump: the speed it leaves the floor at, solved so the held jump's
 *  highest point is JUMP_SCALE times the old one's, and `leap`, what a jump taken
 *  along the run multiplies the run by, so a running jump covers JUMP_SCALE times
 *  the old one's floor. `apex` (m), `air` (s) and `rise` (s, to the apex) are that
 *  jump's. */
export function jumpArc(fighter: FighterId) {
  let arc = arcs.get(fighter);
  if (!arc) {
    const scale = JUMP_SCALE[fighter] ?? 3, apex = scale * JUMP_BEFORE.apex;
    let lo = 8.8, hi = 60;
    for (let i = 0; i < 48; i++) { const mid = (lo + hi) / 2; if (flight(mid, vy => jumpGravity(vy, false)).apex < apex) lo = mid; else hi = mid; }
    const own = flight(hi, vy => jumpGravity(vy, false)), air = own.ticks / 60;
    arc = { speed: hi, leap: scale * JUMP_BEFORE.carry / (7.5 * air), apex: own.apex, air, rise: own.top / 60 };
    arcs.set(fighter, arc);
  }
  return arc;
}
/** Round 4b (JUMP): bunny-hopping. The leap multiplied whatever the fighter left
 *  the floor with, so a jump taken again on the landing multiplied the last leap:
 *  six mashed jumps left the floor at 17, 39, 91, 208, 479 and 1100 m/s, and
 *  covered 3.4-7.9x the ground a run did in the time. Now a jump leaps only once
 *  the fighter has been on the floor LEAP_GROUNDED (s); one taken sooner keeps no
 *  more than a run's worth of what it landed with. A full jump's landing - one
 *  that meets the floor at JUMP_LAND_HARD (m/s) or more; a hop lands at 20 at
 *  most - takes JUMP_LAND_RECOVERY (s) before the next jump or dash, the press
 *  waiting for it (attacks and the guard come out at once). A single jump and its
 *  leap are what they were; six chained ones cover a run's ground. */
export const LEAP_GROUNDED = .3, JUMP_LAND_RECOVERY = .1, JUMP_LAND_HARD = 21;
/** An attack thrown on the way up a jump keeps no more than this much of its
 *  climb (m/s). The jump leaves the floor at over twenty metres a second now, and
 *  an air cast falls at AIR_CAST_GRAVITY: a jab pressed off the floor rose
 *  another twenty metres. At this the blow comes out at about the height it was
 *  pressed at, which is the air game the old jump had. */
export const AIR_CAST_RISE = 4;
/** How fast that climb is taken off (1/s): a few ticks, so the rise eases into
 *  the blow rather than stopping on one frame. */
export const AIR_CAST_BRAKE = 30;
/** The air strike (combos.ts airHeavy) from the new heights: a blow down out of
 *  the air dives - at the body it was thrown at, inside AIR_STRIKE_REACH on the
 *  floor plane and not above the thrower, to meet it on the blow; or, at nobody,
 *  down and on along its facing (AIR_STRIKE_BLIND, m/s forward and down). No
 *  faster than AIR_STRIKE_SPEED, and climbing no faster than AIR_CAST_RISE. From
 *  four metres up its old hover put the blow over everybody's head. */
export const AIR_STRIKE_REACH = 8, AIR_STRIKE_SPEED = 28;
export const AIR_STRIKE_BLIND: readonly [number, number] = [6, 11];
/** An air string's opener thrown at a body in the air inside its reach is aimed
 *  to be level with it on the blow (from four metres a jump passed a launch by
 *  long before a jab could land), dropping no faster than this (m/s). */
export const AIR_HOME_DROP = 12;
export const JUGGLE_LIFT = 6.2;
export const JUGGLE_DECAY = .24;
export const MAX_JUGGLE = 4;
/** A dash is a burst with a shape, not a square wave. It used to switch on at
 *  twenty-four metres a second for a fifth of a second and switch off again,
 *  which is the same one-tick velocity step the ground ramp was added to get
 *  rid of - and three times larger. These are the fractions of the dash spent
 *  building and bleeding off; the peak is raised so the ground covered is
 *  exactly what it was.
 *
 *  Displacement is the integral of the trapezoid, so the peak multiplier is
 *  1/(1-(rise+fall)/2). Keeping it exact matters: every bot dodge read and
 *  every spacing decision in the game is calibrated on how far a dash goes. */
export const DASH_SECONDS = .22;
export const DASH_RISE = .24, DASH_FALL = .32;
export const DASH_PEAK = 1 / (1 - (DASH_RISE + DASH_FALL) / 2);
/** Where in the dash the burst is, as a fraction, for the renderer to line the
 *  clip's own accent up with. */
export const DASH_BURST = DASH_RISE + (1 - DASH_RISE - DASH_FALL) * .35;
/** How far into a dash a given fraction of it is, as a multiple of the peak.
 *  Shared, because the client predicts with this code. */
export function dashShape(through: number) {
  const u = Math.max(0, Math.min(1, through));
  if (u < DASH_RISE) return DASH_PEAK * (u / DASH_RISE);
  if (u > 1 - DASH_FALL) return DASH_PEAK * ((1 - u) / DASH_FALL);
  return DASH_PEAK;
}

/** Where the dash goes depends on where the stick is. A dash with the stick
 *  pulled back is a backdash: shorter, and the first part of it is an evade,
 *  which is what makes it a way out of pressure rather than a slower run. A
 *  dash with the stick across the facing is a sidestep: shorter again, and
 *  no evade. Forward and neutral are the dash as it always was - 0.22 s and
 *  5.277 m from a standing start - and that number is pinned by
 *  tests/feel.test.ts, because every bot read is calibrated on it.
 *
 *  `along` is the stick's dot product with the facing: below BACKDASH_ALONG
 *  it is a backdash, inside SIDESTEP_ALONG either side of zero a sidestep. */
export type DashKind = 'forward' | 'back' | 'side';
export const DASH_EVADE = .13;
export const BACKDASH_SECONDS = .16, BACKDASH_TRAVEL = 3.2, BACKDASH_EVADE = .12, BACKDASH_ALONG = -.5;
export const SIDESTEP_SECONDS = .18, SIDESTEP_TRAVEL = 3.6, SIDESTEP_ALONG = .35;
/** The peak speed that makes the tick-sampled trapezoid cover `travel` metres
 *  in `seconds`. The simulation samples the shape once per tick from the tick
 *  the dash begins on, so the integral is a sum rather than the analytic one,
 *  and the ground covered has to come out exact for the same reason the
 *  forward dash's does. */
export function dashPeakSpeed(seconds: number, travel: number, dt = 1 / SIMULATION_HZ) {
  let sum = 0;
  for (let k = 0; k * dt < seconds; k++) sum += dashShape(k * dt / seconds) * dt;
  return travel / sum;
}

/** An air dash aims at the locked opponent rather than straight ahead: without
 *  it a launch is unfollowable and the juggle exists only on paper. */
export const AIR_DASH_SPEED = 21;
/** How long a jump, dash or attack press survives while it cannot be acted on.
 *  Without it, chasing a launch means pressing jump on exactly the frame the
 *  launcher's recovery opens, and every press before that is thrown away. */
export const INPUT_BUFFER = .18;
/** Fighters whose rig carries the donated air attacks. The four who fight with
 *  a weapon in hand are not among them: the donated kicks move the arms
 *  neutrally, which sends a katana swinging, so they keep their own swing in
 *  the air. tests/reactions.test.ts fails if this drifts from the assets. */
export const AIR_NORMAL_FIGHTERS: FighterId[] = ['konta', 'kosho', 'gummy', 'koko', 'ouga', 'taisei', 'oro'];
/** What a normal thrown off the ground is called. The animation is a kick for
 *  everyone who has one, so announcing the grounded move's name would be a lie. */
export const AIR_NORMALS: Partial<Record<AttackSlot, string>> = { light: 'Knee Hitch', heavy: 'Falling Kick' };

export const SIMULATION_HZ = 60;
/** Broadcast rate, not simulation rate: both sides still step at 60. A 50 ms
 *  grid is coarser than the interpolation delay has headroom for, which is
 *  what made remote fighters stall for a frame or four several times a second;
 *  a 33 ms grid gives the visual clock most of a frame of slack per packet.
 *  ArenaRoom derives its divisor from these two, so nothing else moves. */
export const SNAPSHOT_HZ = 30;
export const MAX_PLAYERS = 12;
export const MAX_HP = 1000;
export const COMBO_HP = 1500;
/** The ultimate bar is spent whole, like the awakening's. Since round 13 the
 *  two are separate meters: this one fills from damage dealt and buys the
 *  ultimate; the awakening fills from damage taken (awakening.ts). */
export const ULTIMATE_COST = 100;
/** What the meters are worth per point of damage. The attacker's ultimate
 *  bar fills from damage dealt; the defender's awakening fills from damage
 *  taken, and a little from what a guard turned away - a fighter who blocks
 *  well still gets their transformation, just later. */
export const ULTIMATE_PER_DAMAGE = .12;
export const AWAKENING_PER_DAMAGE = .14, AWAKENING_PER_BLOCKED = .05;
export const ARENA_HALF_EXTENT = 80;
/** How much room a body takes up when another one walks into it. Separate
 *  from PLAYER_RADIUS, which is hit-detection padding and was tuned as such:
 *  one number doing both jobs let two 1.7 m humanoids stand 0.90 m apart -
 *  inside each other, on screen - because widening it to fix that would have
 *  widened every hitbox in the game with it. Deliberately just under the
 *  tightest measured connect distance (taisei's light lands from 1.14 m centre
 *  to centre, scripts/probe_melee_gap.mts), so nothing starts whiffing off a
 *  gap the pushbox opened. */
export const PUSH_RADIUS = 0.55;
export const PLAYER_RADIUS = 0.45;
/** A public match that kicks off with fewer fighters than this is filled to
 *  it with bots, so a lone player who queued up gets a fight. */
export const MIN_MATCH_FIELD = 6;
export const PLAYER_HEIGHT = 1.8;

/** Physics and visuals consume the same server-safe source layout. */
export const ARENA_COLLIDERS = ENVIRONMENT_COLLIDERS;
