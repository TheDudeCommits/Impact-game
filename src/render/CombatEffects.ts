import { RosterSignatureSet, hasRosterSignature, lazyLayer, prefetchSignature, type LazyLayer } from './signature/RosterSignatureSet';
import { AreaCastFx } from '../originals/areaCastFx';
import { armoryDraws, flightKept } from './vfx/armory/drawn';
import { isFullBeamPressure } from './signature/FullBeamPressureContact';
import { isPyroclastExplosions } from './signature/PyroclastExplosionsContact';
import { isAmpereSurge } from './signature/AmpereSurgeContact';
import { ShanxiaoRampage, isShanxiaoRampage } from './signature/ShanxiaoRampage';
import { isKuzuChainsaw } from './signature/KuzuChainsawContact';
import { isShakugoMagma } from './signature/ShakugoMagmaContact';
import { comboMove, type ComboKey } from '../game/combos';
import * as THREE from 'three';
import { energyOrbMaterial, energyHaloMaterial, energyImpactMaterial, pressureWaveMaterial, groundDustMaterial } from './vfx/EnergyOrbMaterial';
import { taimatsuGeometry } from './vfx/TaimatsuGeometry';
import { taimatsuMaterial } from './vfx/TaimatsuMaterial';
import { windBladeGeometry, windBladeMaterial } from './vfx/WindBlade';
import { VfxKit, bodyCentre, DUST_LIT, DUST_SHADE, DREAM_IMPACT, type ImpactClass, type HitTier } from './vfx/VfxKit';
import { SPRITE, ORIENT } from './vfx/SparkField';
import { MotionFx, type ScreenFx } from './vfx/MotionFx';
import { VictimVeil, installVeil, VEIL } from './vfx/VictimVeil';
import { elementFor, enderElement, ghostTint, techniqueColour, gradeHue, gradeStrength, PHYSICAL, type Element } from './vfx/palette';
import { MOVES, type MoveDefinition } from '../game/moves';
import {moveFor, rushMove} from '../game/awakening';
import type { AttackSlot, CombatEvent, FighterId, PlayerState } from '../game/types';
import { strikeOffsets } from '../engine/sim/areaDamage';
import { Fighter } from './Fighter';
import { LANDED } from '../game/landedBlows';
import { BlastAreas } from './signature/BlastArea';
import { BOMB_COMMIT, BOMB_HOME, bombLead, homeStep, homeWant, inRange } from '../game/bombAim';
import { OPENER_FEED, undecided } from './signature/ultimateClock';
// Round 5 (PARRY): the guard aura and the block, parry and guard-break bursts.
import { GuardFx } from './vfx/GuardFx';
import { SorayomiWeather } from './signature/SorayomiWeather';
import { isRoseEmpress } from './signature/RoseEmpressContact';
import { bigBlowOf, cinematicBlowOf } from './bigBlowEvent';
import { VFX } from './vfxLevel';
import { LOCK_ESCAPE_WINDOW } from '../game/lockCombat';
export type { ScreenFx } from './vfx/MotionFx';

type CastView = {
  event: CombatEvent; group: THREE.Group; rings: THREE.Mesh[]; streams?: THREE.InstancedMesh;
  start: THREE.Vector3; end: THREE.Vector3; hitEnd?: THREE.Vector3;
  hitTargetId?: string; hitAt?: number;
  release: number; duration: number; travel: number; released: boolean; contactAt?: number; beamReleasedAt?: number;
  palmCharges?:THREE.Mesh[];
  /** A thrown weapon flying in place of the orb (THROWN): shown from just before it leaves the hand. */
  weapon?:THREE.Object3D;
  ownedMaterial?:THREE.ShaderMaterial; contactIndex?:number;
  kurobi?:boolean;
  presentedAge?:number;
  /** A combo ender's own move, kept from the cast: looked up every frame otherwise (comboMove names its cache). */
  ender?:MoveDefinition;
  /** Round 4b (FMOVES): where a shot aimed as it is let go (MoveDefinition.aimOnRelease) was let go at - its release's
   *  endpoint - and whether the flight has taken it up. */
  aimed?:THREE.Vector3; aimedDone?:boolean;
  /** Round 8 (ULT AIM): a bomb aimed as it is let go (followBomb): the body it is thrown at - its thrower's target, kept
   *  from the release on - the floor under it when it was last on one, and where the drawn flight set off for before
   *  the release's word came in (what its homing is held to until then). */
  foe?:string; foeFloor?:number; homeFrom?:THREE.Vector3;
  /** Where the fighter was standing, and whether the cast's endpoint is a
   *  wall or the floor rather than the end of its range in open air. */
  floor: number; surface: boolean;
  /** Emission clocks for the effects a beam or a shot keeps making. */
  nextSpark: number; nextRing: number; nextMuzzle: number; nextRock: number; nextTrail: number; nextGather: number; scorched: boolean;
};
/** A burst in flight. Melee sparks are drawn by the sprite field and need no
 *  meshes; energy and ultimate bursts borrow a pooled slot for their shell. */
type Impact = { born: number; duration: number; size: number; energy: boolean; seed: number; slot?: BurstSlot; ultimate?: boolean; follow?: Fighter; offset?: THREE.Vector3 };
/** A signature technique the generic cast path does not draw - a Sickle Bolt, a
 *  Haizan, a spirit's barrage - still lights the room in its colour, rising to
 *  the release and dying away after it. */
type Glow = { actorId: string; slot: AttackSlot; born: number; release: number; end: number; colour: number; peak: number; reach: number; left?: number };
/** Round 3d (ULTS): a whiffed ultimate's light fades over WHIFF_FADE.
 *  Round 3e (ULTFIX): a hit-confirm ultimate's grade holds OPENER_FEED past
 *  its opener, and then OPENER_FEED at a time for as long as the verdict is
 *  out (holdVerdictGrades) - the confirm hands it to the cinematic's, and a
 *  whiff lets it go at once. It held a whole second past the opener, over a
 *  whiff that was over in half of one (the third critic's SETSUNA blue). */
/** A roster signature draws this move's wind-up and flight (hasRosterSignature), unless its fighter's casting draws only
 *  where it lands (drawn.ts flightKept): then they are still drawn here, and the casting takes over at the hit. */
const rosterFlight = (id: string | undefined, slot?: string, branch?: string, player?: string) =>
  hasRosterSignature(id, slot, branch, player) && !flightKept(id, slot, branch, player);
const WHIFF_FADE = .25;
/** Round 3d (ULTS): the blast rings' colours (signature/BlastArea): the Spirit
 *  Bomb's pale blue, the Azure Foxfire's violet, the sun's orange; round
 *  3e (ULTFIX), the PLANETARIUM's lilac. */
const BLAST_TINT: Partial<Record<FighterId, number>> = { taisei: 0x9fe0ff, konta: 0xb04bff, kagari: 0xff8a2a, kuon: 0x9d7bff, 'jinlin': 0xff4a12 };
type BurstSlot = {
  group: THREE.Group; rim: THREE.MeshBasicMaterial; streaks: THREE.InstancedMesh; ink: THREE.InstancedMesh; inkMaterial: THREE.MeshBasicMaterial;
  shell: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>; pressure: THREE.Mesh<THREE.RingGeometry, THREE.ShaderMaterial>;
  dust: THREE.InstancedMesh<THREE.SphereGeometry, THREE.ShaderMaterial>; debris: THREE.InstancedMesh; debrisMaterial: THREE.MeshBasicMaterial; busy: boolean;
};
const UP = new THREE.Vector3(0, 1, 0);
const FORWARD = new THREE.Vector3(0, 0, 1);
const WHITE = new THREE.Color(1, 1, 1);

/** A projectile in the air, for the effects that dress one after it has left
 *  the caster: Signal Fire's fire and COUP DE FEU's follow the body drawn here,
 *  and GummyEffects has no other way of knowing where that body is. Keyed by
 *  cast event and contact; `released` is false while it is still a charge on
 *  the hand or the foot. `branch` is the combo ender (game/combos.ts) the cast
 *  was, so a layer that dresses its slot's projectile (Signal Fire, Taimatsu, Blue,
 *  the knives) leaves an ender's alone or dresses it as the ender it is. */
export interface Flight { fighter: FighterId; slot: AttackSlot; branch?: ComboKey; /** Who threw it. */ actorId?: string; position: THREE.Vector3; heading: THREE.Vector3; origin?: THREE.Vector3; released: boolean; since: number; awakened?: boolean }
export const FLIGHTS = new Map<string, Flight>();
/** Which fighters draw their thrown special as fire rather than as ki. */
const FLAME_THROWERS = new Set<FighterId>(['gummy', 'kosho', 'kagari']);
/** Taisei's Sunpalm Cannon ball at full charge (radius, metres): the size of his two cupped hands round it. */
const SUNPALM_BALL = .15;
/** Whose projectiles another effects layer dresses in flight: the flame
 *  throwers' fire, and Setsu's lightning (SetsuEffects reads FLIGHTS). */
const FLIGHT_DRESSED = new Set<FighterId>([...FLAME_THROWERS, 'setsu', 'kuon', 'gaunt', 'sorayomi', 'basilissa', 'shakugo', 'shanxiao', 'ampere', 'pyroclast', 'full-beam', 'oyashio', 'buna', 'akaito', 'shijima', 'tancho', 'bellows', 'cardo', 'bruin']);
/** Whose heavy is thrown steel: no ki body and no charge light, but the cast
 *  still keeps a flight, and SwordSpiritEffects draws the knives on it. */
const KNIFE_THROWERS = new Set<FighterId>(['oro']);
/** A cast that is that knife throw: never a combo ender, which is drawn as its own move (ENDER_THROWN for an ender
 *  that is steel thrown), not as LORD ORO's heavy - SwordSpiritEffects dresses only the heavy's flights. */
const clockHandKnives = (event: CombatEvent) => !event.branch && !!event.fighter && KNIFE_THROWERS.has(event.fighter);
/** Kagari's ultimate is a bomb drawn as a sun: the ALL ABLAZE is a
 *  ball of fire the size of a house lifted over his head and thrown. Every
 *  other flame thrower's projectile is a fist or a foot with fire on it, so
 *  the ember-sized charge and the fist-sized flight are wrong for it. */
const isSun = (fighter: FighterId | undefined, slot: string | undefined) => fighter === 'kagari' && slot === 'ultimate';
const SUN_RADIUS = 2.2;
const SUN_HEIGHT = 3.6;
const CRESCENT_ARC = Math.PI * 1.15;
const flightKey = (cast: { event: CombatEvent; contactIndex?: number }) => `${cast.event.id}:${cast.contactIndex ?? 0}`;
const SPIRIT_RADIUS = 2.3;
/** The Great Kazeyose's radius at `age` into Konta's Light x3, Heavy, its blow at `release`: NinjaEffects draws its
 *  currents on the same. */
export function bigBall(age: number, release: number) {
  return (.05 + THREE.MathUtils.smoothstep(age, .04, release * .92) * .25) * (1 - THREE.MathUtils.smoothstep(age, release + .1, release + .36));
}
const SPIRIT_HEIGHT = 4.65;
/** Round 3c: the Azure Foxfire read small ("a small purple sphere") - a 2.9 m ball for a move that hits 6 m round it, and Kurobi's no bigger than its head. Radii (metres): Konta's held ball and Kurobi's (gathered in front of its jaws). Round 3e (ULTFIX): the burst's dome is the blast's own radius (ultimateBurst). */
export const FOXFIRE_ORB = { held: 2, kurobi: 3 } as const;
/** Jinlin's Drowned Sun, held over the finger he raises and thrown: its radius (metres). Smaller than the
 *  LAST SUN's, which is lifted over its thrower; this one grows on his hand, and he is not tall. */
const DROWNED_SUN = 1.5;
const ORB_FORWARD = new THREE.Vector3();
/** The four beams, by colour. `scale` is the drawn tube's radius against the
 *  move's hitbox radius: the hitbox includes the glow, the tube is the body. */
const BEAM_LOOKS: Record<string, { shell: number; edge: number; light: number; spike: number; scale: number; lit?: number }> = {
  'taisei:special': { shell: 0x2fb4ff, edge: 0x0a30d0, light: 0x46c3ff, spike: 0xc8f6ff, scale: .88 },
  'wuming:special': { shell: 0xff56c5, edge: 0x53094f, light: 0xff80dc, spike: 0xffd5f5, scale: .88 },
  'ouga:special': { shell: 0xa650ff, edge: 0x3a0aa0, light: 0xa860ff, spike: 0xf0d6ff, scale: .9 },
  // Gold light on a sunlit gold room adds brightness and no colour: the
  // Royal Aurora lights it at a little over half the strength of the others.
  'ouga:ultimate': { shell: 0xffb81c, edge: 0xff5a00, light: 0xffe07a, spike: 0xfff2b0, scale: .72, lit: .55 },
  'kuon:special': { shell: 0xc446ff, edge: 0xff28bc, light: 0xd050ff, spike: 0xffd8fb, scale: .88 },
};

/** The same beams as elements, for the sprites their heads throw: built once
 *  so a beam's frame allocates nothing. */
const BEAM_ELEMENTS: Record<string, Element> = Object.fromEntries(Object.entries(BEAM_LOOKS).map(([key, look]) => [key, { spike: look.spike, rim: look.shell, light: look.light, ink: look.edge }]));

/** Ignore older interpolated poses, but never release a charge cancelled by a newer action. */
export function chargeWasCancelled(event: CombatEvent, release: number, state: PlayerState | undefined, now: number) {
  const age = now - event.serverTime;
  if (!state) return age > .12;
  const sameCast = state.action === event.slot && (event.actionSeq!==undefined&&state.actionSeq===event.actionSeq||Math.abs(state.actionStarted - event.serverTime) < .075);
  if (sameCast && state.alive) return false;
  // A snapshot newer than release may contain ordinary recovery or a later hit;
  // that must not erase a projectile which already left the caster.
  const actionAge = state.actionStarted - event.serverTime;
  return age > .1 && actionAge >= -1e-6 && actionAge < release - 1 / 120;
}

/** The dream loop (22 October 2026): which finishing blow a hit is (VfxKit's HitTier) - a launcher rises, a knockdown
 *  slams into the floor, a blowback, a stun, an air strike or a string's last light blows the body away. */
export function hitTier(slot?: AttackSlot, branch?: ComboKey, chain?: number): HitTier | undefined {
  if (branch === 'llh' || branch === 'airSpecial') return 'launch';
  if (branch === 'lllh') return 'slam';
  if (branch === 'lh' || branch === 'llls' || branch === 'airHeavy') return 'finish';
  if (slot === 'light' && (chain ?? 0) >= 3) return 'finish';
  return undefined;
}

/** How loud a hit is, from what it was worth and where it sits in its move.
 *  A rush finisher and the last contact of a string are promoted: they are
 *  the blow the string was building to. */
export function impactClass(event: CombatEvent, move?: MoveDefinition): ImpactClass {
  const damage = event.damage ?? 40;
  let cls: ImpactClass = damage < 50 ? 0 : damage < 115 ? 1 : damage < 220 ? 2 : 3;
  if (event.slot === 'light' && (event.chain ?? 0) >= 3) cls = Math.max(cls, 2) as ImpactClass;
  const final = !!move && move.contacts.length > 1 && event.contactIndex === move.contacts.length - 1;
  if (final) cls = Math.max(cls, event.slot === 'ultimate' ? 3 : event.slot === 'light' ? 1 : 2) as ImpactClass;
  // (15 October, the feel pass) A special's last blow is a class-2 spark - and so its manga panel - whatever it dealt:
  // every one of the sixteen originals' is (by damage, or a barrage's by its last contact above), and 23 of the 60 newer
  // fighters' single-blow specials (98 to 114 damage, under the 115 line) landed a jab's spark with no panel. Not a combo
  // ender, which is its own blow. The damage is the simulation's and is untouched.
  const lastBlow = !move || event.contactIndex === undefined || event.contactIndex >= move.contacts.length - 1;
  if (event.slot === 'special' && !event.branch && lastBlow) cls = Math.max(cls, 2) as ImpactClass;
  if (DREAM_IMPACT && event.branch) cls = Math.max(cls, event.branch === 'llh' || event.branch === 'lllh' || event.branch === 'airHeavy' ? 3 : 2) as ImpactClass;
  return cls;
}

/** (15 October, the feel pass) What the screen answers a blow by - the camera's kick and the frame's bite (main.ts) -
 *  is its damage, with the last blow of a heavy, an ultimate and an area move never under SCREEN_FLOOR: the originals'
 *  own (their second-lightest heavy, KoKo's ultimate finisher, Gaunt' last area strike). Basilissa's two-kick heavy,
 *  Lanthorn' and Tsubute's ultimates and four area moves of the 60 newer fighters bit and kicked under every original's.
 *  Not a combo ender; the damage is the simulation's and is untouched. */
export const SCREEN_FLOOR: Partial<Record<AttackSlot, number>> = { heavy: 52, ultimate: 245, area: 40 };
export function screenWorth(event: CombatEvent): number {
  const damage = event.damage ?? 40, floor = event.slot && !event.branch ? SCREEN_FLOOR[event.slot] : undefined;
  if (!floor || damage >= floor || !event.fighter || !event.slot) return damage;
  const move = thrown(event.fighter, event.slot, undefined, false);
  const count = event.slot === 'area' ? strikeOffsets(move).length : move.contacts.length;
  return event.contactIndex === undefined || event.contactIndex >= count - 1 ? floor : damage;
}

/** Round 3b (HITFEEL): the manga panel - the whole frame turned to paper and
 *  ink for a frame or two (GameRenderer.impactFrame) - is rationed. It printed
 *  on every rush finisher, one panel for every fighter's, and a blind critic
 *  read the strings as templated. An ultimate's blow and a knockout print it
 *  every time; a special's, a parry's vanish and the finisher of a long string
 *  (LONG_STRING hits) only once PANEL_REST seconds have passed without one;
 *  every other finisher is drawn as its fighter's own (FINISHERS). */
export const PANEL_REST = 5, LONG_STRING = 7;
/** The feel pass: how long an ultimate's finishing panel holds, past its own frame or two (about six
 *  frames at 30 fps). One flash, so within the three-a-second limit. */
export const IMPACT_FRAME_HOLD = .2;
/** How a finisher lands, drawn on its blow instead of the shared panel. */
/** (`own`: nothing here - the fighter's own module draws the finisher, as the dark-magic fighters' darkness does.) */
type Accent = 'shockwave' | 'hammer' | 'smoke' | 'bolt' | 'spiral' | 'tornado' | 'rising' | 'flurry' | 'crescent' | 'cross' | 'room' | 'red' | 'crater' | 'own';
/** Each fighter's rush finisher: the shape it is drawn with, in the stage's
 *  own colour, and the screen's answer for the fighter whose fight it is -
 *  speed lines, a colour fringe, or a flash of that colour over the room.
 *  Skyfall Smash is a ki shockwave, the Double Axe Handle and the Slab Smash
 *  break the floor, Up You Go!! pops its clones, Hawk Combo, the Lightning
 *  Kick and the Hailstone Palm crackle, the Riptide Fist twists, Dust Devil
 *  is a tornado of cuts, the Flambe Kick a column of fire, the spirits'
 *  cries a flurry of fists, the Accent Scorch a crescent, Rekka a
 *  cross of fire, Gurney Lift the ROOM under the body, Nova a repelling
 *  burst. */
/** A form whose string is its own ends it its own way: the YUGE's haymaker a flurry of fists (the Scout's rising
 *  cut is Levin's tornado of steel). */
const FORM_FINISHERS: Partial<Record<FighterId, { shape: Accent; screen: 'speed' | 'fringe' | 'grade' }>> = { hawser: { shape: 'flurry', screen: 'fringe' } };
export const FINISHERS: Record<FighterId, { shape: Accent; screen: 'speed' | 'fringe' | 'grade' }> = {
  chohan:{shape:'crescent',screen:'speed'},
  aqrab:{shape:'tornado',screen:'fringe'},
  tsubute:{shape:'shockwave',screen:'fringe'},
  yodaka:{shape:'crescent',screen:'speed'},
  ume:{shape:'crater',screen:'fringe'},
  lanthorn:{shape:'cross',screen:'fringe'},
  highsun:{shape:'cross',screen:'fringe'},
  torsion:{shape:'tornado',screen:'fringe'},
  kubiwa:{shape:'room',screen:'fringe'},
  onigawara:{shape:'crescent',screen:'speed'},
  cardo:{shape:'own',screen:'speed'},
  minase:{shape:'spiral',screen:'speed'},
  aquilo:{shape:'spiral',screen:'speed'},
  'psyche':{shape:'flurry',screen:'fringe'},
  'ovid':{shape:'flurry',screen:'fringe'},
  hawser:{shape:'tornado',screen:'speed'},
  rotfalke:{shape:'crescent',screen:'fringe'},
  bonsho:{shape:'flurry',screen:'fringe'},
  murex:{shape:'flurry',screen:'fringe'},
  kinu:{shape:'flurry',screen:'fringe'},
  'madake':{shape:'shockwave',screen:'fringe'},
  akayuri:{shape:'crescent',screen:'fringe'},
  hagure:{shape:'crescent',screen:'fringe'},
  hisame:{shape:'crescent',screen:'fringe'},
  svanhild:{shape:'crescent',screen:'fringe'},
  mizuhiki:{shape:'crescent',screen:'fringe'},
  'shibuichi':{shape:'crescent',screen:'fringe'},
  'rakucho':{shape:'crescent',screen:'fringe'},
  irbis:{shape:'crescent',screen:'fringe'},
  shidare:{shape:'crescent',screen:'fringe'},
  hinomoto:{shape:'crescent',screen:'fringe'},
  amagoi:{shape:'room',screen:'fringe'},
  'shakudo':{shape:'spiral',screen:'speed'},
  hikui:{shape:'cross',screen:'fringe'},
  tokan:{shape:'rising',screen:'fringe'},
  strappado:{shape:'cross',screen:'fringe'},
  unari:{shape:'cross',screen:'fringe'},
  barrow:{shape:'crater',screen:'fringe'},
  sashigane:{shape:'crescent',screen:'speed'},gosu:{shape:'flurry',screen:'fringe'},
  kusushi:{shape:'bolt',screen:'fringe'},hakushi:{shape:'bolt',screen:'fringe'},
  suzuran:{shape:'bolt',screen:'fringe'},wataame:{shape:'crescent',screen:'speed'},bruin:{shape:'own',screen:'speed'},
  senko:{shape:'bolt',screen:'speed'},buna:{shape:'hammer',screen:'fringe'},
  oyashio:{shape:'shockwave',screen:'grade'},adad:{shape:'bolt',screen:'fringe'},
  akaito:{shape:'shockwave',screen:'grade'},
  shijima:{shape:'shockwave',screen:'grade'},
  tempo:{shape:'bolt',screen:'fringe'},
  tancho:{shape:'shockwave',screen:'grade'},bellows:{shape:'shockwave',screen:'grade'},mikage:{shape:'bolt',screen:'fringe'},
  'full-beam': { shape: 'shockwave', screen: 'speed' },
  pyroclast: { shape: 'shockwave', screen: 'speed' },
  ampere: { shape: 'shockwave', screen: 'speed' },
  shanxiao: { shape: 'shockwave', screen: 'speed' },
  kuzu: { shape: 'crescent', screen: 'fringe' },
  shakugo: { shape: 'crescent', screen: 'grade' },
  strix: { shape: 'crescent', screen: 'grade' },
  'basilissa': { shape: 'crescent', screen: 'fringe' },
  sorayomi: { shape: 'bolt', screen: 'grade' },
  taisei: { shape: 'shockwave', screen: 'speed' }, ouga: { shape: 'hammer', screen: 'fringe' },
  konta: { shape: 'smoke', screen: 'grade' }, shiden: { shape: 'bolt', screen: 'grade' },
  shirokane: { shape: 'bolt', screen: 'speed' }, gummy: { shape: 'spiral', screen: 'speed' },
  kenzo: { shape: 'tornado', screen: 'grade' }, kosho: { shape: 'rising', screen: 'grade' },
  koko: { shape: 'flurry', screen: 'fringe' }, nigo: { shape: 'crescent', screen: 'grade' },
  kagari: { shape: 'cross', screen: 'grade' }, ward: { shape: 'room', screen: 'grade' },
  kuon: { shape: 'red', screen: 'fringe' }, oro: { shape: 'flurry', screen: 'grade' },
  gaunt: { shape: 'crater', screen: 'fringe' }, setsu: { shape: 'bolt', screen: 'speed' },
  // The shop's fighters: the mast-breaker craters the floor, the quake goes out in a
  // ring, Sorrel's sabre's last cut is a crescent, and HORIZON SUNDER's splits the sky.
  gorai: { shape: 'crater', screen: 'fringe' }, haldor: { shape: 'shockwave', screen: 'grade' }, sorrel: { shape: 'crescent', screen: 'fringe' },
  dorado: { shape: 'crescent', screen: 'grade' },
  // FERMATA's is the coffin itself.
  shiun: { shape: 'room', screen: 'grade' },
  // Calamity Pyre's arrow bursts as a cross of fire.
  magatsu: { shape: 'cross', screen: 'grade' },
  // The Updraft's last cut is a crescent of white steel.
  vesper: { shape: 'crescent', screen: 'speed' },
  // The Rising Barb breaks the air round them.
  imago: { shape: 'shockwave', screen: 'fringe' },
  // The Root-Out Smash bursts in rose.
  'wuming': { shape: 'shockwave', screen: 'speed' },
  // Banjaku's Crushing Heel drives them into the floor; Jinlin's tail sweeps them back.
  banjaku: { shape: 'crater', screen: 'fringe' },
  'jinlin': { shape: 'crescent', screen: 'speed' },
  // Gohaku's Mountain Hammer brings both fists down on them, into the floor.
  'gohaku': { shape: 'hammer', screen: 'fringe' },
  // Ippon's Clock-In Kick breaks the air round them.
  ippon: { shape: 'shockwave', screen: 'speed' },
  // Sekka's Icefall Hammer drives them into the floor.
  sekka: { shape: 'crater', screen: 'fringe' },
  // Tobari's Rookwing Rise lifts them; the finisher bursts in crows' black and the Red Eye's red.
  tobari: { shape: 'crescent', screen: 'grade' },
  // Akagane's meteor leaves a crater; Asahi's fire cuts a crescent; Levin spins through them; Rook's shadows cross.
  akagane: { shape: 'crater', screen: 'fringe' },
  asahi: { shape: 'crescent', screen: 'grade' },
  levin: { shape: 'tornado', screen: 'speed' },
  'rook': { shape: 'cross', screen: 'grade' },
  // Gaku's Lion Fist goes off like Taisei's blows do, the air ringing out round it.
  gaku: { shape: 'shockwave', screen: 'speed' },
};
/** A blow's spark is drawn on the frame it reached the body (Fighter's
 *  touches), and the event that confirms it does not draw it again: the one
 *  touch of the same swing and contact, however long the event took across
 *  the network (TOUCH_KEPT at most), or - for an event that carries no swing -
 *  the oldest of the pair's inside TOUCH_SPARK, in seconds of the effects'
 *  clock. Only blows the simulation landed are touched (Fighter, LANDED). */
const TOUCH_SPARK = .45, TOUCH_KEPT = 2;
/** Mages whose close blows are their magic (Aquilo's wind blades, Svanhild's water): their sparks land in the move's own
 *  colours (the blast look) where the dream loop paints a bare hand's blow warm. (dark-magic round 19: the blind critics,
 *  rounds 8 to 16, "orange hit sparks" on Aquilo's white wind.) */
const MAGIC_MELEE: ReadonlySet<string> = new Set(['aquilo', 'svanhild']);
const OWN_STEEL: ReadonlySet<string> = new Set(['cardo', 'bruin', 'minase']);

/** The move an event's cast threw: a combo ender's own (game/combos.ts), or its slot's - so an ender thrown from the
 *  special is drawn as what it is, never as the special. */
function thrown(fighter: FighterId, slot: AttackSlot, branch: ComboKey | undefined, kurobi: boolean, awakened = kurobi): MoveDefinition {
  return (branch ? comboMove(fighter, branch, awakened) : undefined) ?? moveFor(fighter, slot, kurobi);
}

type Thrown = 'spear' | 'katana' | 'thunder' | 'dagger' | 'jets' | 'quarrel' | 'yoyo';
const THROWN: Partial<Record<FighterId, Partial<Record<AttackSlot, Thrown>>>> = { vesper: { special: 'spear' }, asahi: { heavy: 'katana' }, levin: { heavy: 'thunder' } };
/** The combo enders (combos.ts) that are a weapon thrown: Rook's Talon Volley is his daggers. */
const ENDER_THROWN: Partial<Record<FighterId, Partial<Record<ComboKey, Thrown>>>> = { 'rook': { airHeavy: 'dagger' },
  // The main game's (COMBOS-DATA's rows): LORD ORO's Gilded Glare is two jets of fluid, Gaunt' Scrap Repeater
  // its bolts, Setsu's yo-yo his steel yo-yo.
  oro: { lh: 'jets' }, gaunt: { lh: 'quarrel' }, setsu: { lh: 'yoyo' } };
/** How big a main-game ender flies, where it is not a ki blast's 0.4 m: Shiden's Fireball Arts and the Void Ray are big,
 *  the Water Dragon's head bigger, Ouga's energy volley and the Spark Hail small, Kagari's fire as his fire flies. */
const ENDER_SIZE: Partial<Record<FighterId, Partial<Record<ComboKey, number>>>> = {
  shiden: { lllh: .55, airHeavy: .14 }, nigo: { llls: .45 }, shirokane: { lh: .5, airHeavy: .3 }, ouga: { llls: .2 },
};
/** Main-game enders thrown as more than one: the energy volley, Hidama's bullets of flame, the repeater's bolts. */
const ENDER_VOLLEY: Partial<Record<FighterId, Partial<Record<ComboKey, number>>>> = { ouga: { llls: 5 }, kagari: { lh: 3 }, gaunt: { lh: 3 } };
/** What a main-game ender leaves behind it in flight besides its light: the Water Dragon's spray, the Fireball's smoke. */
const ENDER_TRAIL: Partial<Record<FighterId, Partial<Record<ComboKey, 'water' | 'fire'>>>> = { shirokane: { lh: 'water' }, shiden: { lllh: 'fire' } };
/** And those thrown as light in a colour the fighter's own is not: Tobari's crow fire is fire, Shiun's Storm Psalm
 *  lightning's yellow. */
const ENDER_TINT: Partial<Record<FighterId, Partial<Record<ComboKey, number>>>> = { tobari: { airHeavy: 0xff6a1a }, shiun: { lh: 0xffe27a } };
/** Whose enders throw no light of their own: Gaunt' are a man and a sword. */
const PLAIN_ENDERS: ReadonlySet<FighterId> = new Set<FighterId>(['gaunt']);
const WEAPON_PARTS: Record<Thrown, readonly [THREE.BufferGeometry, number, number][]> = {
  // [geometry, colour, offset along the flight]: the shaft or blade along +Y, its point forward.
  spear: [[new THREE.CylinderGeometry(.022, .022, 2.1, 6), 0x5b4a3a, 0], [new THREE.ConeGeometry(.06, .34, 6), 0xdfe5ea, 1.2]],
  katana: [[new THREE.BoxGeometry(.034, .98, .008), 0x1d2328, .18], [new THREE.CylinderGeometry(.075, .075, .02, 10), 0x8a6a2a, -.32], [new THREE.CylinderGeometry(.018, .018, .26, 6), 0x2a2a2a, -.46]],
  thunder: [[new THREE.CylinderGeometry(.03, .03, .9, 8), 0x5e6469, 0], [new THREE.ConeGeometry(.045, .2, 8), 0x9aa1a6, .55], [new THREE.CylinderGeometry(.036, .036, .06, 8), 0xb02020, .3]],
  dagger: [[new THREE.BoxGeometry(.04, .42, .008), 0x9aa1a6, .14], [new THREE.CylinderGeometry(.016, .016, .15, 6), 0x1c1a24, -.15]],
  // Two thin jets side by side; a short bolt, its head and its fletching; a steel disc.
  jets: [[new THREE.CylinderGeometry(.014, .006, 1.7, 6).translate(.07, 0, 0), 0xf4f8ff, 0], [new THREE.CylinderGeometry(.014, .006, 1.7, 6).translate(-.07, 0, 0), 0xf4f8ff, 0]],
  quarrel: [[new THREE.CylinderGeometry(.014, .014, .52, 6), 0x5b4a3a, 0], [new THREE.ConeGeometry(.032, .11, 6), 0x9aa1a6, .31], [new THREE.BoxGeometry(.06, .1, .006), 0xd8d0c0, -.22]],
  yoyo: [[new THREE.CylinderGeometry(.1, .1, .05, 18).rotateZ(Math.PI / 2), 0x9aa1a6, 0], [new THREE.CylinderGeometry(.03, .03, .07, 10).rotateZ(Math.PI / 2), 0x30343a, 0]],
};
const WEAPON_MATERIALS = new Map<number, THREE.MeshStandardMaterial>();
/** A thrown weapon, pointed from `origin` to `endpoint`. */
function thrownWeapon(kind: Thrown, origin: { x: number; y: number; z: number }, endpoint: { x: number; y: number; z: number }) {
  const weapon = new THREE.Group(); weapon.name = `thrown-${kind}`;
  for (const [geometry, colour, along] of WEAPON_PARTS[kind]) {
    let material = WEAPON_MATERIALS.get(colour);
    if (!material) { material = new THREE.MeshStandardMaterial({ color: colour, roughness: .45, metalness: colour === 0xdfe5ea || colour === 0x9aa1a6 ? .6 : .1 }); WEAPON_MATERIALS.set(colour, material); }
    const part = new THREE.Mesh(geometry, material); part.position.y = along; weapon.add(part);
  }
  const direction = new THREE.Vector3(endpoint.x - origin.x, endpoint.y - origin.y, endpoint.z - origin.z);
  if (direction.lengthSq() > 1e-6) weapon.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return weapon;
}

/** Lock combat's gold: a round's last blow and its escape window (CombatEffects.lockGap). */
const LOCK_GOLD = 0xffc93a;
/** Lock combat's speed afterimages behind a blow (CombatEffects.lockBlow): [metres back along the blow, opacity, life s]. */
const LOCK_STREAKS: readonly (readonly [number, number, number])[] = [[.09, .55, .13], [.19, .38, .12], [.3, .22, .1]];

export class CombatEffects {
  /** Lock combat's preview (game/lockCombat.ts; main.ts sets it on that build): a string's blows drawn with a bloom,
   *  ring and streaks (lockBlow) - and its finisher without the paper panel, which a blind critic read as "a single 40 ms
   *  frame of black-and-white comic panel" cutting the string where it should hold, flash and throw. */
  static lockLook = false;
  /** The shared pools: sprites, rubble, marks, ghosts, beams, lights. */
  readonly kit: VfxKit;
  /** Who is taking a blow, so the effects drawn over them thin out there. */
  readonly veil = new VictimVeil();
  private motion = new MotionFx();
  private casts: CastView[] = [];
  private impacts: Impact[] = [];
  private slots: BurstSlot[] = [];
  private seen = new Set<number>();
  private kontaHeavyCasts=new Set<string>();
  private detonations = new Set<string>();
  private sphere = new THREE.SphereGeometry(1, 32, 24);
  private fistGeometry = taimatsuGeometry();
  private ring = new THREE.TorusGeometry(1, .013, 4, 48);
  private windBlade = windBladeGeometry();
  private windMaterial = windBladeMaterial();
  private pressureGeometry = new THREE.RingGeometry(.001, 1, 64, 12);
  private spark = new THREE.ConeGeometry(1, 1, 3);
  private inkGeometry = new THREE.ConeGeometry(1.5, 1.08, 3);
  /** COUP DE FEU's crescent: an open arc of torus that flies with its back
   *  leading, the way a thrown blade wave reads. */
  private crescentGeometry = new THREE.TorusGeometry(1, .16, 6, 28, CRESCENT_ARC);
  private crescentMaterial = new THREE.MeshBasicMaterial({ color: 0xff8a1a, transparent: true, opacity: .92, depthWrite: false, toneMapped: false });
  private core = energyOrbMaterial();
  private spirit = energyOrbMaterial(false, true);
  private halo = energyHaloMaterial();
  private cyan = new THREE.MeshBasicMaterial({ color: 0x36caff, transparent: true, opacity: .7, depthWrite: false, toneMapped: false });
  private violet = energyOrbMaterial(true);
  private scratch = new THREE.Object3D();
  private scratchColor = new THREE.Color();
  private tint = new THREE.Color();
  private direction = new THREE.Vector3();
  private head = new THREE.Vector3();
  private bombAt = new THREE.Vector3();
  private bombAim = new THREE.Vector3();
  private beamDir = new THREE.Vector3();
  private blow = new THREE.Vector3();
  private centre = new THREE.Vector3();
  private limb = new THREE.Vector3();
  private blade = new THREE.Vector3();
  private glows: Glow[] = [];
  /** Taisei's ground smash, the Grand Sunpalm Cannon (combosVol1.ts): the beam driven down into where he lands, for as long
   *  as it burns. Pooled; at most two. */
  private downBeams = Array.from({ length: 2 }, () => ({ from: new THREE.Vector3(), to: new THREE.Vector3(), born: -9, seed: 1 }));
  private warm?: THREE.Group;
  /** The frame's post effects, whose fight this is, and the live settings
   *  (the HUD edits that object in place). main.ts sets all three. */
  screen?: ScreenFx;
  /** When the last impact blur was thrown, on the effects' clock (one in 0.3 s at most). */
  private lastBlur = -10;
  localId?: string;
  settings?: { effects: number; quality: 'high' | 'medium' | 'low' };
  private lastFrame = -1e9;
  private lastChroma = -1e9;
  /** When the manga panel last printed (see PANEL_REST), on the same clock. */
  private lastPanel = -1e9;
  /** Touches already drawn (Fighter.touchLog), and the sparks each attacker
   *  and victim pair has had drawn that their events have not yet claimed:
   *  when, and for which swing (input edge) and contact. */
  private touchSeen = 0;
  private touchSparks = new Map<string, { at: number; seq: number; index: number }[]>();

  /** Round 3d (ULTS): the area ultimates' blasts, marked on the floor from the cast. */
  private blast: BlastAreas;
  /** Round 5 (PARRY): the guard's own layer (vfx/GuardFx). */
  readonly guard: GuardFx;
  private weather: SorayomiWeather;
  private empress: LazyLayer;
  private chainsaw: LazyLayer;
  private berserker: ShanxiaoRampage;
  private rosterSignatures: RosterSignatureSet;
  private pressure: LazyLayer;
  private explosions: LazyLayer;
  private cowling: LazyLayer;
  private magma: LazyLayer;
  private areaCasts: AreaCastFx;
  constructor(private scene: THREE.Scene) {
    this.kit = VfxKit.for(scene);
    this.guard = new GuardFx(scene, this.kit);
    this.weather = new SorayomiWeather(scene, this.kit);
    this.empress = lazyLayer(isRoseEmpress, () => import('./signature/RoseEmpress').then(m => (s, k) => new m.RoseEmpress(s, k)), scene, this.kit);
    this.chainsaw = lazyLayer(isKuzuChainsaw, () => import('./signature/KuzuChainsaw').then(m => (s, k) => new m.KuzuChainsaw(s, k)), scene, this.kit);
    this.berserker = new ShanxiaoRampage(scene, this.kit);
    this.rosterSignatures = new RosterSignatureSet(scene, this.kit);
    this.pressure = lazyLayer(isFullBeamPressure, () => import('./signature/FullBeamPressure').then(m => (s, k) => new m.FullBeamPressure(s, k)), scene, this.kit);
    this.explosions = lazyLayer(isPyroclastExplosions, () => import('./signature/PyroclastExplosions').then(m => (s, k) => new m.PyroclastExplosions(s, k)), scene, this.kit);
    this.cowling = lazyLayer(isAmpereSurge, () => import('./signature/AmpereSurge').then(m => (s, k) => new m.AmpereSurge(s, k)), scene, this.kit);
    this.magma = lazyLayer(isShakugoMagma, () => import('./signature/ShakugoMagma').then(m => (s, k) => new m.ShakugoMagma(s, k)), scene, this.kit);
    this.areaCasts = new AreaCastFx(scene, this.kit);
    this.blast = new BlastAreas(scene);
    // Bursts borrow a slot instead of building a group, materials and three
    // instanced meshes on the frame a blow lands; every slot exists from the
    // start, so the load-time compile has linked all of their programs.
    for (let i = 0; i < 8; i++) this.slots.push(this.makeSlot());
    this.warmup();
  }

  get density() { return this.kit.density; }
  /** Rooms past let go, as a room is entered (RosterSignatureSet.retainEffects): the Armory effect types but `keep` and the room's castings'. */
  retainEffects(keep: ReadonlySet<string>): string[] { return this.rosterSignatures.retainEffects(keep); }
  /** Fetches `id`'s own layer ahead without building it (at idle on the home, and as a fighter is picked there). */
  prefetch(id: FighterId) { prefetchSignature(id); for (const layer of [this.empress, this.chainsaw, this.pressure, this.explosions, this.cowling, this.magma]) layer.prefetchFor?.(id); }
  load(ids: readonly FighterId[]) { this.areaCasts.load(ids); return Promise.all([this.weather.load(ids), this.empress.load(ids), this.chainsaw.load(ids), this.magma.load(ids), this.berserker.load(ids), this.rosterSignatures.load(ids), this.cowling.load(ids), this.pressure.load(ids), this.explosions.load(ids)]).then(() => {}); }
  set density(value: number) { this.kit.density = value; }
  get quality() { return this.kit.quality; }
  set quality(value: 'high' | 'medium' | 'low') { this.kit.quality = value; }

  private makeSlot(): BurstSlot {
    const group = new THREE.Group(); group.name = 'combat-burst-idle'; group.visible = false;
    const rim = installVeil(new THREE.MeshBasicMaterial({ color: 0x08baff, transparent: true, opacity: .95, depthWrite: false, toneMapped: false }), VEIL.sparks) as THREE.MeshBasicMaterial;
    const streaks = new THREE.InstancedMesh(this.spark, rim, 22);
    streaks.name = 'impact-outward-streaks'; streaks.frustumCulled = false; streaks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < 22; i++) streaks.setColorAt(i, WHITE);
    const inkMaterial = installVeil(new THREE.MeshBasicMaterial({ color: 0x111620, transparent: true, opacity: 1, depthWrite: false, toneMapped: false }), VEIL.sparks) as THREE.MeshBasicMaterial;
    const ink = new THREE.InstancedMesh(this.inkGeometry, inkMaterial, 22);
    ink.name = 'manga-ink-ray-contours'; ink.frustumCulled = false; ink.instanceMatrix = streaks.instanceMatrix; ink.renderOrder = 0; streaks.renderOrder = 1;
    // One program for every tint: the shell's hard-coded blue becomes a
    // uniform once, here, instead of a string-replaced variant per hit.
    const shellMaterial = energyImpactMaterial(false, .24, false);
    shellMaterial.fragmentShader = shellMaterial.fragmentShader.replace('uniform vec3 uTint;', 'uniform vec3 uTint;uniform vec3 uAccent;').replace('vec3(.01,.22,1.)', 'uAccent');
    shellMaterial.uniforms.uAccent = { value: new THREE.Color().setRGB(.01, .22, 1) };
    const shell = new THREE.Mesh(this.sphere, shellMaterial); shell.name = 'impact-pressure-shell';
    const pressure = new THREE.Mesh(this.pressureGeometry, pressureWaveMaterial()); pressure.name = 'impact-ground-wave'; pressure.rotation.x = -Math.PI / 2; pressure.frustumCulled = false;
    const dust = new THREE.InstancedMesh(this.sphere, groundDustMaterial(), 12); dust.name = 'impact-ground-dust'; dust.frustumCulled = false; dust.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const debrisMaterial = installVeil(new THREE.MeshBasicMaterial({ color: 0x6c604b, transparent: true, opacity: 1, depthWrite: false }), VEIL.rubble) as THREE.MeshBasicMaterial;
    const debris = new THREE.InstancedMesh(this.spark, debrisMaterial, 10); debris.name = 'impact-ground-debris'; debris.frustumCulled = false; debris.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    group.add(shell, pressure, dust, debris, streaks, ink); this.scene.add(group);
    return { group, rim, streaks, ink, inkMaterial, shell, pressure, dust, debris, debrisMaterial, busy: false };
  }

  private takeSlot() {
    let slot = this.slots.find(s => !s.busy);
    if (!slot) {
      // All eight in use: retire the oldest burst that holds one.
      const oldest = this.impacts.find(i => i.slot)!;
      this.releaseSlot(oldest); this.impacts.splice(this.impacts.indexOf(oldest), 1); slot = oldest.slot!;
    }
    slot.busy = true;
    return slot;
  }
  private releaseSlot(impact: Impact) { const slot = impact.slot; if (!slot) return; slot.busy = false; slot.group.visible = false; slot.group.name = 'combat-burst-idle'; }

  /** Every material a cast can use, on a hidden mesh, so the load-time
   *  compile links them before the first charge rather than on it. Hidden
   *  from the start: `renderer.compile` walks invisible objects too, so the
   *  programs are linked without anything being drawn. */
  warmup() {
    if (this.warm) return;
    const group = new THREE.Group(); group.name = 'combat-effects-warmup';
    const tinted = this.tintedOrb(0xff8a1a), fist = taimatsuMaterial();
    const streams = new THREE.InstancedMesh(this.spark, this.cyan, 1);
    group.add(new THREE.Mesh(this.sphere, this.core), new THREE.Mesh(this.sphere, this.spirit), new THREE.Mesh(this.sphere, this.violet), new THREE.Mesh(this.sphere, this.halo),
      new THREE.Mesh(this.ring, this.cyan), new THREE.Mesh(this.crescentGeometry, this.crescentMaterial), new THREE.Mesh(this.windBlade, this.windMaterial),
      new THREE.Mesh(this.sphere, tinted), new THREE.Mesh(this.fistGeometry, fist), streams);
    group.traverse(o => { o.frustumCulled = false; });
    group.position.set(0, -500, 0); group.scale.setScalar(.001); group.visible = false;
    this.scene.add(group); this.warm = group;
  }
  hideWarmup() { if (this.warm) this.warm.visible = false; }

  /** The ki orb recoloured. The same replacement every time, so however many
   *  tints there are it is one program. */
  private tintedOrb(tint: number) {
    const material = this.core.clone();
    material.uniforms.uTint.value.set(tint);
    material.fragmentShader = material.fragmentShader.replace('vec3(.012,.25,1.0)', 'uTint*1.5').replace('vec3(.05,.2,.7)', 'uTint*.7');
    return material;
  }

  /** AreaTelegraph selects authored area events: Yodaka's area impact or Chohan's physical sweep.
   * Forward only to that signature, without generic flight/charge or Forge cues. */
  handleAuthoredAreas(events: readonly CombatEvent[], fighters: ReadonlyMap<string, Fighter>) {
    for (const event of events) if (event.slot === 'area' && (
      event.fighter === 'yodaka' && event.kind === 'impact'
      || event.fighter === 'chohan' && (event.kind === 'cast' || event.kind === 'release' || event.kind === 'impact')
    )) this.rosterSignatures.handleOwn(event, fighters);
  }

  private bodies?: ReadonlyMap<string, Fighter>;
  handle(events: CombatEvent[], fighters?: ReadonlyMap<string,Fighter>) {
    if (fighters) this.bodies = fighters;
    // What the timeline hands over is what the server landed (see LANDED): in
    // the arcade, where nothing is predicted, it is all the ledger knows.
    LANDED.deliver(events);
    for (const event of events) {
      if (this.seen.has(event.id)) continue; this.seen.add(event.id);
      this.weather.handle(event, fighters);
      this.empress.handle(event, fighters);
      this.chainsaw.handle(event, fighters);
      this.berserker.handle(event, fighters);
      this.rosterSignatures.handle(event, fighters);
      if(fighters)this.rosterSignatures.prepareContact(event,fighters,FLIGHTS);
      this.pressure.handle(event, fighters); this.explosions.handle(event, fighters);
      this.cowling.handle(event, fighters);
      this.magma.handle(event, fighters);
      if (event.kind === 'hit' && event.targetId) this.veil.struck(event.targetId, event.serverTime, DREAM_IMPACT && !!hitTier(event.slot, event.branch, event.chain));
      if (event.kind === 'cast' && event.fighter && event.slot && event.origin && event.endpoint) this.cast(event, fighters);
      if (DREAM_IMPACT && event.kind === 'cast' && event.fighter && event.slot) this.windup(event, fighters);
      // Round 3d (ULTS): a hit-confirm ultimate landed - its grade holds for the cinematic.
      if (event.kind === 'confirm' && event.fighter && event.slot === 'ultimate') this.confirmed(event, fighters);
      if (event.kind === 'land' && event.origin) {
        // An ultimate's launch coming down: the floor takes it.
        this.kit.groundImpact(event.origin.x, event.origin.y, event.origin.z, 0, 1, 0, 3, event.serverTime, undefined, event.origin.y);
        this.kit.pulse(event.origin.x, event.origin.y + 1.6, event.origin.z, 0xffe2b0, 8, 7, event.serverTime, .3);
        this.impacts.push({ born: event.serverTime, duration: .65, size: 1, energy: false, seed: event.id });
      }
      if (event.kind === 'release' && event.fighter === 'taisei' && event.branch === 'airSpecial' && event.endpoint) {
        // The Grand Sunpalm Cannon fired down at the floor he lands on: from the height he dropped from, straight down.
        const beam = this.downBeams[0].born <= this.downBeams[1].born ? this.downBeams[0] : this.downBeams[1], e = event.endpoint;
        beam.to.set(e.x, e.y - .3, e.z); beam.from.set(e.x, e.y + 3.4, e.z); beam.born = event.serverTime; beam.seed = event.seed ?? event.id;
      }
      if (event.kind === 'release') {
        // An iai draw (Mirage Draw) is released along the line its dash ran.
        const released = event.fighter && event.slot ? thrown(event.fighter, event.slot, event.branch, false) as MoveDefinition & { dashThrough?: boolean } : undefined;
        // A released beam may enter team vision after its hidden charge.
        // Reconstruct that missed cast at release age from the already-clipped
        // visible segment; never invent a charge or move a projectile's clock.
        if(released?.style==='beam'&&!event.branch&&BEAM_LOOKS[`${event.fighter}:${event.slot}`]&&event.origin&&event.endpoint&&!this.casts.some(c=>c.event.actorId===event.actorId&&c.event.slot===event.slot&&Math.abs(event.serverTime-c.event.serverTime-c.release)<1)){
          this.cast({...event,kind:'cast',serverTime:event.serverTime-(released.contacts[0]??0)},fighters);
        }
        if (released?.dashThrough && event.origin && event.endpoint) this.iai(event, fighters);
        for (const cast of this.casts) {
          if (cast.event.actorId === event.actorId && cast.event.slot === event.slot
            && this.releases(cast, event)) { // Round 3c (LOCK): late beams as well.
            cast.beamReleasedAt = event.serverTime;
          }
          // Round 4b (FMOVES): a shot aimed as it is let go flies where its release says (the cast said where it was
          // pointed at the press). A round trip late at most: the word on the local fighter's own shot comes back.
          if (cast.event.actorId === event.actorId && cast.event.slot === event.slot && event.endpoint && !cast.aimedDone
            && (cast.contactIndex ?? 0) === (event.contactIndex ?? 0) && released?.aimOnRelease
            && Math.abs(event.serverTime - cast.event.serverTime - cast.release) < .35) {
            (cast.aimed ??= new THREE.Vector3()).set(event.endpoint.x, event.endpoint.y, event.endpoint.z);
          }
        }
      }
      if (event.kind === 'projectile-clash') {
        // Two shots annihilated each other: neither reaches its end, so
        // neither may burst there as a miss.
        for (const cast of this.casts) if ((cast.event.actorId === event.actorId || cast.event.actorId === event.targetId) && cast.released && cast.contactAt === undefined) cast.contactAt = event.serverTime;
        const at = event.endpoint ?? event.origin;
        if (at) this.kit.hitSpark(at.x, at.y, at.z, elementFor(event.fighter, event.slot), 2, event.serverTime);
      }
      if (event.kind === 'wall-splat' && event.origin) this.wallSplat(event, fighters);
      if (event.kind === 'ground-bounce' && event.origin) {
        const o = event.origin;
        this.kit.groundImpact(o.x, o.y, o.z, 0, 1, 0, 2, event.serverTime, undefined, o.y);
      }
      if (event.kind === 'vanish') this.vanish(event, fighters);
      if (event.kind === 'lock-gap') this.lockGap(event, fighters);
      if (event.kind === 'chase') {
        // A dash chase or a light chase: ghosts and torn wind until it lands.
        this.motion.chase(event.actorId, event.serverTime);
        const o = event.origin, chaser = fighters?.get(event.actorId);
        if (o) {
          this.kit.ring(o.x, o.y + 1, o.z, .3, 1.8, event.serverTime, .25, 0xffffff, 0xbfe6ff, .1);
          // Dust only off the floor: a chase launched in the air kicks up nothing.
          if (!chaser || chaser.state.grounded) this.kit.dustRing(o.x, chaser ? chaser.group.position.y : o.y, o.z, 5, .2, 3, .8, event.serverTime, .5);
        }
      }
      if (event.kind === 'eliminated') this.knockout(event, fighters);
      if (event.kind === 'just-guard') this.perfectGuard(event, fighters);
      if (event.kind === 'blocked' || event.kind === 'guard-break' || event.kind === 'just-guard') this.guard.event(event, fighters); // Round 5 (PARRY)
      if ((event.kind === 'hit' || event.kind === 'blocked' || event.kind === 'guard-break') && event.endpoint) this.contact(event, fighters);
    }
    if (this.seen.size > 2048) this.seen = new Set(Array.from(this.seen).slice(-1024));
  }

  private cast(event: CombatEvent, fighters?: ReadonlyMap<string,Fighter>) {
    const fighterId = event.fighter!, slot = event.slot!;
    if(fighterId==='konta'&&slot==='heavy'&&event.actionSeq!==undefined){
      const key=`${event.actorId}:${event.actionSeq}`;if(this.kontaHeavyCasts.has(key))return;
      this.kontaHeavyCasts.add(key);
      if(this.kontaHeavyCasts.size>256)this.kontaHeavyCasts.delete(this.kontaHeavyCasts.values().next().value!);
    }
    const actor=fighters?.get(event.actorId);
    const kurobi=fighterId==='konta'&&!!actor?.state.awakened;
    const move = thrown(fighterId,slot,event.branch,kurobi,!!actor?.state.awakened);
    this.technique(event, move, actor);
    // Round 3d (ULTS): an area ultimate hits everyone inside its blast, and
    // where that is is fixed on the cast - so it is marked there, now.
    if (slot === 'ultimate' && move.style === 'bomb' && event.origin && event.endpoint) {
      const o = event.origin, e = event.endpoint, release = event.serverTime + (move.contacts[0] ?? 0);
      const travel = Math.max(.06, Math.hypot(e.x - o.x, e.y - o.y, e.z - o.z) / (move.speed ?? 20));
      this.blast.mark(event.id, event.actorId, e.x, e.y - 1.05, e.z, move.radius, event.serverTime, release, release + travel, BLAST_TINT[fighterId] ?? 0xffffff);
    }
    const domain = slot === 'ultimate' && (fighterId === 'kuon' || fighterId === 'magatsu') ? move.timeStop : undefined;
    if (domain && event.origin) {
      const o = event.origin, closes = event.serverTime + (move.contacts[domain.contact] ?? 0);
      this.blast.mark(event.id, event.actorId, o.x, o.y - 1.05, o.z, domain.radius, event.serverTime, closes, closes, fighterId === 'magatsu' ? 0xff2a3a : BLAST_TINT.kuon ?? 0xffffff);
    }
    // FERMATA's reliquary is Shiun's own (EmperorEffects): no orb of energy where it closes.
    // Nor is an orb what Jinlin's barrage throws: its pearl lances are his (EmperorEffects).
    // Nor Sorrel' Horizon Sunder, a cut (an orb of the default blue filled the screen at its opener), nor Gohaku's
    // Sun-Seizing Spiral, whose two fingers and spiral are his (a gold orb buried them): the blind critics, 3 October.
    // (Round 4b: Gummy's barrage is fists, GummyEffects' - a line of them, not a beam of light.)
    const drawnElsewhere = fighterId === 'sorayomi' && slot === 'ultimate' && !event.branch || fighterId === 'strix' && slot === 'special' && !event.branch || ['shirokane','shiden','kenzo','nigo','koko'].includes(fighterId) && !event.branch || fighterId === 'gummy' && slot === 'special' && !event.branch || fighterId === 'shiun' && slot === 'ultimate' || (fighterId === 'sorrel' || fighterId === 'gohaku') && slot === 'ultimate' || fighterId === 'jinlin' && slot === 'special' || fighterId === 'tobari' && slot === 'special' || fighterId === 'akagane' && slot === 'special' || fighterId === 'rook' && slot === 'special' || fighterId === 'ippon' && slot === 'heavy' && !event.branch || move.style === 'melee' && !(fighterId === 'konta' && slot === 'heavy' && (!event.branch || event.branch === 'lllh')) || kurobi && move.style === 'melee';
    if (drawnElsewhere) { this.glow(event, move, actor); return; }
    // A combo ender over an area (combos.ts: a snare, a ground smash) is drawn where it lands (EmperorEffects), not as a
    // ball of light at the hand: a snare's hand glows as it is cast, a smash shows nothing until the floor takes it.
    if (event.branch && move.style === 'field') { if (!move.plunge) this.glow(event, move, actor); return; }
    if (this.casts.length >= 24) this.removeCast(this.casts.shift()!);
    const isSpirit = fighterId === 'taisei' && slot === 'ultimate';
    const group = new THREE.Group(); group.name = `cast-${event.id}`;
    const flame=FLAME_THROWERS.has(fighterId);
    const kuon=fighterId==='kuon';
    // (A combo ender thrown from the slot is not its signature: no Taimatsu fist, no Kazeyose in the palm - combos.ts.)
    const taimatsu=fighterId==='kagari'&&slot==='special'&&!event.branch;
    // (His Light x3, Heavy is the Great Kazeyose: a Kazeyose in the palm, bigger - combosVol1.ts.)
    const palmKazeyose=fighterId==='konta'&&slot==='heavy'&&!kurobi&&(!event.branch||event.branch==='lllh');
    // Ouga's ki is tinted per move; a thrown fist or kick is tinted to
    // its fire, and the flames themselves are GummyEffects', following
    // FLIGHTS. Kosho's carries the crescent in front of the body. Gaunt'
    // cannon is a shell of fire, not a ball of ki. The shop's fighters throw
    // their own power, not ki: Grog Gale's wind white over violet, Faultline Fist's
    // quake white into blue, Dorado's flintlock ball wrapped in his will's
    // gold, and Shiun's light pale seraph's. Gaku's open palm is his aura, the Landslide's gold.
    // (4 October, combos.ts: Imago's Hive Burst is his jade, Sekka's Frost Gale the frost stance's ice-blue shock.
    // Ippon's sneeze is no ball of anything: a gust, EmperorEffects'.)
    const SHOP_TINT:Partial<Record<FighterId,number>>={sorayomi:0x9adeef,gorai:0xd2c2ff,haldor:0xe2f2ff,dorado:0xffb21e,shiun:0xb48cff,magatsu:0xff4a5a,'wuming':0xff6ad8,banjaku:0xff3a2a,'jinlin':0xff5a1e,'gohaku':0xffe25a,gaku:0xffc23c,imago:0x3ae88a,sekka:0x9fdcff};
    // An ender is its own colour, never its slot's: the shop's where ENDER_TINT says, the main game's sixteen always in
    // their ender's element (palette ENDER_ELEMENTS) - Ouga's Light, Heavy is not his special's blue.
    const enderTint=event.branch?ENDER_TINT[fighterId]?.[event.branch]??enderElement(fighterId,event.branch,!!actor?.state.awakened)?.rim:undefined;
    const tint=enderTint??(fighterId==='ouga'?(slot==='special'?0x8731dc:slot==='heavy'?0x2dbeff:0xffc82a):kuon?(slot==='special'?0x9b3dff:0x36e8ff):fighterId==='gummy'?0xff3b13:isSun(fighterId,slot)?0xffc23a:fighterId==='kagari'?0xff6a12:fighterId==='gaunt'?0xff6a1a:SHOP_TINT[fighterId]??0xff8a1a);
    const ownedMaterial=taimatsu?taimatsuMaterial():fighterId==='ouga'||flame||kuon||fighterId==='gaunt'||SHOP_TINT[fighterId]!==undefined||enderTint!==undefined?this.tintedOrb(tint):undefined;
    const orb=new THREE.Mesh(this.sphere, ownedMaterial??(isSpirit ? this.spirit : fighterId === 'konta' && (slot === 'ultimate'||kurobi) ? this.violet : this.core));group.add(orb);
    // The shop's thrown weapons (4 October, game/combos.ts): Vesper's spear, Asahi's black katana, Levin's thunder
    // spear and Rook's daggers fly as what they are, not as a ball of light.
    const throwing=event.branch?ENDER_THROWN[fighterId]?.[event.branch]:THROWN[fighterId]?.[slot];
    let weapon:THREE.Object3D|undefined;
    if(throwing&&event.origin&&event.endpoint){orb.visible=false;weapon=thrownWeapon(throwing,event.origin,event.endpoint);weapon.visible=false;group.add(weapon);}
    if(taimatsu){
      orb.name='taimatsu-charge';
      // Taimatsu has a palm, four curled fingers and a thumb. A round core
      // plus a particle tail loses that silhouette even when tinted red.
      const fist=new THREE.Mesh(this.fistGeometry,ownedMaterial);fist.name='taimatsu-taimatsu';fist.visible=false;
      fist.scale.setScalar(4.4);group.add(fist); // Round 4b (FMOVES): a fist of fire the size of a man (3.1).
    }
    // (Konta's Light x3, Special is the Mini Galewheel: the same blades, smaller - combosVol1.ts.)
    const galewheel=fighterId==='konta'&&!kurobi&&(slot==='special'&&!event.branch||event.branch==='llls');
    if(galewheel){
      orb.scale.setScalar(.6);
      const blades=new THREE.Group();blades.name='galewheel-gust-darts';
      for(let i=0;i<4;i++){const blade=new THREE.Mesh(this.windBlade,this.windMaterial);blade.rotation.z=i*Math.PI/2;blades.add(blade);}
      group.add(blades);
    }
    if(fighterId==='kosho'&&!event.branch){const crescent=new THREE.Mesh(this.crescentGeometry,this.crescentMaterial);crescent.name='ram-crescent';crescent.rotation.set(CRESCENT_ARC/2,-Math.PI/2,0);crescent.scale.setScalar(3.4);/* Round 4b (FMOVES): as wide as the shot (1.7) */crescent.visible=false;group.add(crescent);}
    // Taisei's energy gathers inward; orbital rings belong only to Konta's spinning techniques.
    const rings = Array.from({ length: palmKazeyose ? 2 : 0 }, (_, i) => {
      const mesh = new THREE.Mesh(this.ring, this.cyan); mesh.rotation.set(i * 1.05, i * .7, 0); group.add(mesh); return mesh;
    });
    let streams: THREE.InstancedMesh | undefined;
    if (isSpirit) {
      streams = new THREE.InstancedMesh(this.spark, this.cyan, 14);
      streams.instanceMatrix.setUsage(THREE.DynamicDrawUsage); streams.frustumCulled = false; group.add(streams);
    }
    const halo = new THREE.Mesh(this.sphere, this.halo); halo.name='cast-energy-halo'; halo.scale.setScalar(isSpirit ? 1.1 : 1.2); if(!ownedMaterial&&!palmKazeyose)group.add(halo); this.scene.add(group);
    // The group still travels - its position is the flight - it is only not drawn.
    if(clockHandKnives(event)||(isRoseEmpress(fighterId)||isKuzuChainsaw(fighterId)||isShakugoMagma(fighterId)||isShanxiaoRampage(fighterId)||rosterFlight(fighterId,slot,event.branch,event.actorId)||isAmpereSurge(fighterId)||isPyroclastExplosions(fighterId)||isFullBeamPressure(fighterId)))group.visible=false;
    const start = new THREE.Vector3(event.origin!.x, event.origin!.y, event.origin!.z), end = new THREE.Vector3(event.endpoint!.x, event.endpoint!.y, event.endpoint!.z);
    const palmCharges=fighterId==='ouga'&&slot==='ultimate'?[new THREE.Mesh(this.sphere,ownedMaterial),new THREE.Mesh(this.sphere,ownedMaterial)]:undefined;for(const palm of palmCharges??[])this.scene.add(palm);
    // The simulation shortens the endpoint to the first wall on the line, so
    // an endpoint short of the move's range is a surface.
    const floor = actor ? actor.group.position.y : start.y - 1.05, surface = start.distanceTo(end) < move.range - .4 || end.y - floor < .3;
    const clocks = { nextSpark: 0, nextRing: 0, nextMuzzle: 0, nextRock: 0, nextTrail: 0, nextGather: 0, scorched: false };
    this.casts.push({weapon, event, group, rings, streams, start, end, ownedMaterial,palmCharges,kurobi,ender:event.branch?move:undefined,contactIndex:0,release: move.contacts[0], duration: move.duration, travel: start.distanceTo(end) / (move.speed ?? 50), released: false, floor, surface, ...clocks });
    // A volley (ENDER_VOLLEY): the shot again either side of it, each a beat behind the one before.
    const volley=event.branch?ENDER_VOLLEY[fighterId]?.[event.branch]??1:1;
    if(move.style==='projectile'&&volley>1){
      this.beamDir.copy(end).sub(start).setY(0);if(this.beamDir.lengthSq()<1e-6)this.beamDir.set(0,0,1);this.beamDir.normalize();
      for(let shot=1;shot<volley;shot++){
        const copy=group.clone(),copyMaterial=ownedMaterial?.clone(),side=(shot%2?1:-1)*Math.ceil(shot/2)*.42;
        if(copyMaterial)copy.traverse(o=>{if(o instanceof THREE.Mesh&&o.material===ownedMaterial)o.material=copyMaterial;});this.scene.add(copy);
        const at=end.clone().add(this.direction.set(-this.beamDir.z*side,(shot%3-1)*.2,this.beamDir.x*side));
        this.casts.push({event,group:copy,weapon:weapon?copy.getObjectByName(weapon.name):undefined,ownedMaterial:copyMaterial,ender:move,rings:[],start:start.clone(),end:at,contactIndex:100+shot,release:move.contacts[0]+shot*.07,duration:move.duration+shot*.07,travel:start.distanceTo(at)/(move.speed??50),released:false,floor,surface,...clocks});
      }
    }
    if(move.style==='projectile')for(let index=1;index<move.contacts.length;index++){const copy=group.clone();const copyMaterial=ownedMaterial?.clone();if(copyMaterial)copy.traverse(o=>{if(o instanceof THREE.Mesh&&o.material===ownedMaterial)o.material=copyMaterial;});this.scene.add(copy);this.casts.push({event,group:copy,ownedMaterial:copyMaterial,ender:event.branch?move:undefined,rings:[],start:start.clone(),end:end.clone(),contactIndex:index,release:move.contacts[index],duration:move.duration,travel:start.distanceTo(end)/(move.speed??50),released:false,floor,surface,...clocks});}
  }

  /** A signature technique beginning: the frame is graded toward its colour
   *  while it plays, if the look pass can. Your own and those cast near you,
   *  at half strength for someone else's: a technique across the map is not
   *  your screen's business. */
  private technique(event: CombatEvent, move: MoveDefinition, actor?: Fighter) {
    const slot = event.slot!, fighter = event.fighter!;
    if (slot !== 'special' && slot !== 'ultimate') return;
    const screen = this.screen;
    if (!screen || typeof screen.techniqueGrade !== 'function') return;
    const self = this.localId !== undefined ? this.bodies?.get(this.localId) : undefined;
    const mine = event.actorId === this.localId || event.targetId === this.localId;
    const near = !!self && !!actor && self.group.position.distanceTo(actor.group.position) < 14;
    const strength = (slot === 'ultimate' ? gradeStrength(fighter) : .7) * (mine ? 1 : near ? .5 : 0);
    // Round 3c: an ultimate grades the whole frame for its length; a special only a pool round its caster, through the charge to just after the release, so a crowd keeps its colours.
    // Round 3d (ULTS): a hit-confirm ultimate's length is its opener's until
    // it lands, and the confirm holds the grade on through the cinematic
    // (`confirmed`). Round 3e: until the verdict, holdVerdictGrades.
    const graded = slot === 'ultimate' && move.confirm ? Math.min(move.duration, (move.contacts[0] ?? 0) + OPENER_FEED) : move.duration;
    if (strength > 0) { const hue = gradeHue(fighter, slot, !!actor?.state.awakened, event.branch); if (slot === 'ultimate') screen.techniqueGrade(hue, strength, graded); else screen.techniqueGrade(hue, strength * .8, Math.min(move.duration, (move.contacts[0] ?? 0) + .45), actor?.group.position ?? event.origin, 2.6); }
  }

  /** Round 3d (ULTS): a hit-confirm ultimate landed. Its whole-frame grade
   *  holds on through what is left of the move. */
  private confirmed(event: CombatEvent, fighters?: ReadonlyMap<string, Fighter>) {
    const actor = fighters?.get(event.actorId), screen = this.screen;
    if (!screen || typeof screen.techniqueGrade !== 'function' || !event.fighter) return;
    const self = this.localId !== undefined ? this.bodies?.get(this.localId) : undefined;
    const mine = event.actorId === this.localId || event.targetId === this.localId;
    const near = !!self && !!actor && self.group.position.distanceTo(actor.group.position) < 14;
    const strength = (mine ? 1 : near ? .5 : 0) * gradeStrength(event.fighter);
    if (strength <= 0) return;
    const move = moveFor(event.fighter, 'ultimate', !!actor?.state.awakened);
    screen.techniqueGrade(gradeHue(event.fighter, 'ultimate', !!actor?.state.awakened), strength, Math.max(.3, move.duration - (event.castAge ?? move.contacts[0])));
  }

  /** The light of a technique another layer draws. Charges, beams and shots
   *  drawn here light themselves in `updateCast`. */
  private glow(event: CombatEvent, move: MoveDefinition, actor?: Fighter) {
    if ((isRoseEmpress(event.fighter)||isKuzuChainsaw(event.fighter)||isShakugoMagma(event.fighter)||isShanxiaoRampage(event.fighter)||hasRosterSignature(event.fighter,event.slot,event.branch,event.actorId)||isAmpereSurge(event.fighter)||isPyroclastExplosions(event.fighter)||isFullBeamPressure(event.fighter))) return;
    const slot = event.slot!, fighter = event.fighter!, awakened = !!actor?.state.awakened;
    const el = elementFor(fighter, slot, awakened, 0, event.branch);
    // Gaunt' enders are a man and a sword: steel, no light of their own.
    if (event.branch && PLAIN_ENDERS.has(fighter)) return;
    // A plain fist or a plain cut throws no light of its own; a Sickle Bolt, a
    // Kazeyose or Iron Nail does.
    if (slot === 'light' || slot === 'heavy' && (el === PHYSICAL || el.rim === 0xb8c8d8)) return;
    if (this.glows.length >= 16) this.glows.shift();
    const ultimate = slot === 'ultimate';
    this.glows.push({ actorId: event.actorId, slot, born: event.serverTime, release: Math.max(.05, move.contacts[0]), end: move.duration, colour: techniqueColour(fighter, slot, awakened, event.branch),
      peak: ultimate ? 20 : slot === 'special' ? 14 : 9, reach: ultimate ? 12 : 9 });
  }

  /** One technique light's frame. False once it is spent. */
  private updateGlow(g: Glow, time: number, fighters: Map<string, Fighter>) {
    const age = time - g.born, actor = fighters.get(g.actorId);
    if (age < -.1 || age > g.end + .3 || !actor) return false;
    // Cancelled out of the move: gone at once, not held for its full length.
    if (age > .1 && actor.state.action !== g.slot && age < g.release) return false;
    // Round 3d (ULTS): a hit-confirm ultimate that whiffed is over half a
    // second after its opener: its light goes with it.
    if (g.slot === 'ultimate' && age > g.release && age < g.end && (actor.state.action !== 'ultimate' || actor.state.whiffedAt !== undefined)) { g.left ??= age; if (age - g.left > WHIFF_FADE) return false; } // round 3e: from the whiff
    const rise = Math.pow(Math.min(1, Math.max(0, age / g.release)), 1.6);
    const after = age > g.release ? 1 - .55 * Math.min(1, (age - g.release) / Math.max(.1, g.end - g.release)) : 1;
    const out = age > g.end ? 1 - (age - g.end) / .3 : 1;
    const k = rise * after * out * (g.left === undefined ? 1 : 1 - (age - g.left) / WHIFF_FADE);
    if (k > .01) {
      // Ahead of the hands rather than in them: a light inside the caster's
      // fist burns the caster white and lights nothing else.
      actor.chargePosition(this.limb); const yaw = actor.state.yaw;
      this.kit.lights.request(this.limb.x + Math.sin(yaw) * 1.2, this.limb.y + .2, this.limb.z + Math.cos(yaw) * 1.2, g.colour, g.peak * (.15 + .85 * k), g.reach, 1.5 + (g.actorId === this.localId ? 1 : 0));
    }
    return true;
  }

  /** A blow landing, blocked, or breaking a guard. */
  private contact(event: CombatEvent, fighters?: ReadonlyMap<string,Fighter>) {
    const point = new THREE.Vector3(event.endpoint!.x, event.endpoint!.y, event.endpoint!.z);
    for (const cast of this.casts) {
      if (cast.event.actorId !== event.actorId || cast.event.slot !== event.slot || event.serverTime < cast.event.serverTime + cast.release - .04) continue;
      const style = thrown(cast.event.fighter!, cast.event.slot!, cast.event.branch, false).style;
      const age = event.serverTime - cast.event.serverTime;
      if (age > cast.release + cast.travel + .2 && age > cast.duration) continue;
      if (style === 'beam' && (!cast.hitEnd || point.distanceToSquared(cast.start) > cast.hitEnd.distanceToSquared(cast.start))) {
        cast.hitEnd = point.clone(); cast.hitTargetId = event.targetId; cast.hitAt = event.serverTime;
      }
      if (style === 'bomb' || style === 'projectile') cast.contactAt = event.serverTime;
    }
    const source = fighters?.get(event.actorId), victim = event.targetId ? fighters?.get(event.targetId) : undefined;
    // A guard carries no fighter on the event; the attacker's body knows who it is.
    const fighterId = event.fighter ?? source?.state.fighter, slot = event.slot;
    const move = fighterId && slot ? thrown(fighterId, slot, event.branch, false) : undefined;
    const el = elementFor(fighterId, slot, !!source?.state.awakened, event.chain ?? 0, event.branch);
    const local = this.localId !== undefined && (event.actorId === this.localId || event.targetId === this.localId);
    const floor = victim ? victim.group.position.y : point.y - 1.05;
    const origin = event.origin;
    const time = event.serverTime, seed = event.seed ?? event.id;
    const cls = impactClass(event, move);
    if (event.kind === 'blocked' || event.kind === 'guard-break') {
      if (move?.style === 'bomb') this.detonate(event, point, fighterId, el, local, move.radius);
      this.impacts.push({ born: time, duration: .3, size: 1, energy: false, seed });
      return;
    }
    const finisher = slot === 'light' && (event.chain ?? 0) >= 3;
    if (local) {
      // The panel, rationed (see PANEL_REST): an ultimate's blow every time;
      // a special's and a long string's finisher when one has not printed
      // for a while. Every other finisher is its fighter's own (FINISHERS).
      // The feel pass: an ultimate's finishing blow prints the panel and holds it (IMPACT_FRAME_HOLD);
      // a hit-confirmed one's earlier blows leave it to the cuts, the flash and the blur, so the finisher's is never
      // the one the rate limit drops.
      const finalContact = !move || event.contactIndex === undefined || event.contactIndex >= move.contacts.length - 1;
      if (slot === 'ultimate' && finalContact) this.frame(1, IMPACT_FRAME_HOLD);
      else if (slot === 'ultimate' && cls >= 2 && !move?.confirm) this.frame(cls >= 3 ? 1 : .7);
      else if (slot === 'special' && cls >= 2 || finisher && (event.combo ?? 0) >= LONG_STRING && !CombatEffects.lockLook) this.moment(.7);
      // The colour fringe is for the heaviest blows only: on every hit it
      // read as a smeared lens rather than as weight.
      if (cls >= 3) this.chroma(1);
    }
    const melee = move ? move.style === 'melee' : slot !== 'special';
    // (A combo ender is its own move: LORD ORO's knives only where the ender is thrown steel, Konta's Kazeyose never.)
    const thrownSteel = fighterId === 'oro' && slot === 'heavy' && (!event.branch || ENDER_THROWN.oro?.[event.branch] !== undefined);
    const kazeyose = fighterId === 'konta' && slot === 'heavy' && !source?.state.awakened && !event.branch;
    const bomb = slot === 'ultimate' && move?.style === 'bomb';
    // Where it landed, on the body as it is drawn, and which way the blow was
    // going when it did: the spark sits on the fist, the foot, the blade or
    // the side the shot came in on, and fans out away from the attacker.
    if (!bomb) this.contactPoint(event, source, victim, melee && !kazeyose || thrownSteel, point);
    if (kazeyose) source?.chargePosition(point);
    const from = source && melee ? this.limb.copy(source.group.position).setY(point.y) : origin ? this.limb.set(origin.x, origin.y, origin.z) : undefined;
    const dir = from ? this.blow.subVectors(point, from) : undefined;
    if (dir) { if (dir.lengthSq() > 1e-6) dir.normalize(); else dir.set(0, 0, 1); }
    const anchor = this.kit.anchorTo(victim, time, .5);
    // The feel pass: a big blow (game/bigBlow.ts) in the local
    // player's own fight throws the room behind the pair into a zoom blur
    // toward it, both fighters kept sharp (GameRenderer.impactBlur).
    if (CombatEffects.lockLook && local && event.kind === 'hit' && (slot === 'light' || event.branch)) this.lockBlow(point, el, time, victim, finisher || !!event.branch, event.actorId === this.localId ? source : undefined);
    const big = event.kind === 'hit' && (bigBlowOf(event, !!source?.state.awakened) || cinematicBlowOf(event, !!source?.state.awakened));
    if (big && local && victim && time - this.lastBlur > .3) { this.lastBlur = time; this.screen?.impactBlur?.(slot === 'ultimate' ? 1 : .85, point, source ? [source, victim] : [victim]); }
    if (slot === 'ultimate' && move) {
      if (bomb) { this.detonate(event, point, fighterId, el, local, move.radius); return; }
      const key = `${event.actorId}:${event.serverTime.toFixed(5)}`;
      if (this.detonations.has(key)) return;
      this.detonations.add(key); if (this.detonations.size > 64) this.detonations.delete(this.detonations.values().next().value!);
      // A sword cut, a punch or an electric touch remains readable through its
      // contact spark; the barrage's ticks are not a string of bombs.
      if (move.style === 'melee') { if (!this.claimTouchSpark(event)) this.melee(point, el, cls, time, dir, victim, floor, local, seed, anchor, !!source?.armed, hitTier(slot, event.branch, event.chain), MAGIC_MELEE.has(fighterId ?? ''), OWN_STEEL.has(fighterId ?? '')); }
      else this.energy(point, time, seed, el, Math.max(cls, 2) as ImpactClass, local, victim, floor, anchor, dir);
      return;
    }
    // A rush finisher lands as its fighter's own, on top of its spark.
    if (finisher && fighterId && event.kind === 'hit') this.finisherAccent(fighterId, point, dir, victim, floor, time, local, el, !!source?.state.awakened);
    if (DREAM_IMPACT && local && event.kind === 'hit' && cls === 2 && (melee && !kazeyose || thrownSteel)) this.screen?.techniqueGrade?.(0xff4a22, .4, .1, point, 5);
    // Round 25: every melee blow on a body on its feet kicks the dust at its feet - a low ring and a puff thrown back
    // along the blow.
    if (DREAM_IMPACT && event.kind === 'hit' && melee && victim && victim.state.grounded && Number.isFinite(floor)) {
      const at = victim.group.position, dx = dir?.x ?? 0, dz = dir?.z ?? 0, h = Math.hypot(dx, dz) || 1;
      // (Round 70: not a jab's ring - a blind critic: a jab should read as "a few small organic flame bursts, a
      // thin streak and some embers", ours dressed it in "a hard radial star, blue-white blade trail, floor ring, dust
      // puffs and ghost afterimage ... so its jab already reads like a small finisher". Its puff stays.)
      if (cls >= 1) this.kit.ring(at.x, floor + .04, at.z, .15, .55 + cls * .2, time, .22 + cls * .03, DUST_LIT, DUST_SHADE, .12, 'flat');
      if (h > 1e-3 && (dx || dz)) this.kit.dustSpray(at.x, floor, at.z, dx / h, dz / h, cls >= 2 ? 4 : 2, 2.2 + cls * .5, .28 + cls * .06, time, .38, 1.2);
    }
    if (DREAM_IMPACT && local && event.kind === 'hit' && cls >= 3 && (melee && !kazeyose || thrownSteel)) {
      this.screen?.techniqueGrade?.(0xff4a22, .75, .16, point, 7);
      // (An inked impact frame on a launch and a slam was tried: it replaced the contact frame, the one pose the blow
      // has, and the calibration critic marked it down. The panel stays the ultimate's and the long string's.)
    }
    if (melee && !kazeyose || thrownSteel) {
      // Drawn already, on the frame the blow reached the body, where it did.
      if (!(melee && !kazeyose && this.claimTouchSpark(event))) this.melee(point, el, thrownSteel ? Math.min(cls, 1) as ImpactClass : cls, time, dir, victim, floor, local, seed, anchor, !!source?.armed && !thrownSteel, hitTier(slot, event.branch, event.chain), MAGIC_MELEE.has(fighterId ?? ''), OWN_STEEL.has(fighterId ?? ''));
      return;
    }
    this.energy(point, time, seed, el, Math.max(cls, 1) as ImpactClass, local, victim, floor, anchor, dir);
    // The Static Decoy's victim is electrified, and reads it: the
    // current runs up and down the body a few times as it reels.
    if (fighterId === 'shirokane' && slot === 'special' && !event.branch && victim && event.kind === 'hit') this.shock(victim, time, el);
  }
  /** Lightning running over a struck body in three pulses. */
  private shock(victim: Fighter, time: number, el: Element) {
    const c = bodyCentre(victim, this.head), kit = this.kit;
    for (let pulse = 0; pulse < 3; pulse++) for (let i = 0; i < 2; i++) {
      this.centre.set(c.x + (Math.random() - .5) * .45, c.y - .75, c.z + (Math.random() - .5) * .45);
      this.direction.set(c.x + (Math.random() - .5) * .45, c.y + .85, c.z + (Math.random() - .5) * .45);
      kit.crackle(this.centre, this.direction, .18, el, kit.n(9, 3), time + pulse * .14 + i * .03);
    }
    kit.pulse(c.x, c.y + .3, c.z, el.light, 10, 6, time, .5, 1.5);
  }

  /** Where a blow meets the body it struck, as that body is drawn - which
   *  in a launch reaction can be a metre from its logical position. For a
   *  melee blow it is whichever of the attacker's fists, feet or blade is
   *  nearest the victim's spine at the moment of contact, kept to the
   *  surface on the attacker's side; for anything thrown, the side of the
   *  body the shot came in on. The server's endpoint is the victim's centre,
   *  and a spark drawn there covered the torso it was meant to mark. */
  private contactPoint(event: CombatEvent, source: Fighter | undefined, victim: Fighter | undefined, melee: boolean, out: THREE.Vector3) {
    const e = event.endpoint!;
    // A confirmed guardian strike belongs to its native instance, never
    // the caster's praying human hands or generic nearest-limb fallback.
    if(event.fighter==='bonsho'&&event.slot==='ultimate'&&!event.branch&&(event.contactIndex??0)>0){
      if(source?.meleeContactPoint(event.contactIndex!,out))return out;
      return out.set(e.x,e.y,e.z); // Network hit feedback only; no palm invented.
    }
    if (!victim) {
      out.set(e.x, e.y, e.z);
      const o = event.origin;
      if (melee && o) { this.limb.set(e.x - o.x, 0, e.z - o.z); if (this.limb.lengthSq() > 1e-6) out.addScaledVector(this.limb.normalize(), -.3); }
      return out;
    }
    const centre = bodyCentre(victim, this.centre), feet = victim.group.position;
    // The spine, from the drawn pelvis: a little below it to the crown.
    const lowY = centre.y - .75, highY = centre.y + .75;
    let best = Infinity;
    const consider = (p: THREE.Vector3) => {
      const y = Math.min(highY, Math.max(lowY, p.y)), d = Math.hypot(p.x - centre.x, p.y - y, p.z - centre.z);
      if (d < best) { best = d; out.copy(p); }
    };
    if (melee && source) {
      if (source.meleeContactPoint(event.contactIndex ?? 0, this.limb)) consider(this.limb);
      else {
        consider(source.handR); consider(source.handL);
        const right = source.joints.get('RightFoot'), left = source.joints.get('LeftFoot');
        if (right) consider(right.getWorldPosition(this.limb));
        if (left) consider(left.getWorldPosition(this.limb));
        if (source.armed) {
          // Along the blade, the point of it nearest the body: a katana
          // cuts through the middle of its length, not with its tip.
          source.strikePoint(this.blade);
          this.limb.subVectors(this.blade, source.handR); const length = this.limb.lengthSq();
          const t = length > 1e-6 ? Math.min(1, Math.max(0, ((centre.x - source.handR.x) * this.limb.x + (centre.y - source.handR.y) * this.limb.y + (centre.z - source.handR.z) * this.limb.z) / length)) : 1;
          consider(this.limb.multiplyScalar(t).add(source.handR));
        }
      }
    }
    // The side the blow came from, level.
    const ax = source && melee ? source.group.position.x : event.origin?.x ?? feet.x, az = source && melee ? source.group.position.z : event.origin?.z ?? feet.z;
    let nx = ax - centre.x, nz = az - centre.z; const flat = Math.hypot(nx, nz);
    if (flat > 1e-3) { nx /= flat; nz /= flat; } else { nx = Math.sin(victim.state.yaw); nz = Math.cos(victim.state.yaw); }
    if (best > .9) {
      // No limb near the body - a shot, or a pose that has not arrived - so
      // the surface facing the blow, at the height it came in at.
      const height = e.y - (feet.y + 1.05);
      out.set(centre.x + nx * .3, Math.min(highY - .2, Math.max(lowY + .3, centre.y + .1 + height)), centre.z + nz * .3);
      return out;
    }
    // A fist that has sunk into the body is drawn at its surface.
    const y = Math.min(highY, Math.max(lowY, out.y)), dx = out.x - centre.x, dz = out.z - centre.z, radial = Math.hypot(dx, dz);
    if (radial < .24) { out.x = centre.x + nx * .24; out.z = centre.z + nz * .24; }
    out.y = Math.min(highY, Math.max(lowY + .1, y));
    return out;
  }

  /** A physical blow: the spark, and what it does to the floor - dust kicked
   *  out of the far side of the victim, never back over the attacker's feet. */
  private melee(point: THREE.Vector3, el: Element, cls: ImpactClass, time: number, dir: THREE.Vector3 | undefined, victim: Fighter | undefined, floor: number, local: boolean, seed: number, anchor = 0, blade = false, tier?: HitTier, magic = false, ownSteel = false) {
    // The dream loop (22 October 2026): the burst sits on the body as it is drawn. A flung body is drawn a beat behind
    // where the blow found it, and an air string's last burst went off a metre and more from it - on the attacker.
    if (DREAM_IMPACT && victim) { const c = bodyCentre(victim, this.head), d = point.distanceTo(c); if (d > .8) point.sub(c).multiplyScalar(.45 / d).add(c); }
    this.kit.hitSpark(point.x, point.y, point.z, el, cls, time, dir, local ? 2 : 1, anchor, magic ? 'blast' : blade ? 'slash' : 'burst', tier, ownSteel);
    // (Round 38: and a big blow's body trails sparks and speed lines as it is thrown - VfxKit.trail.)
    if (tier && cls >= 2) this.kit.trail(victim, time, blade);
    const feet = victim?.group.position, low = !victim || victim.state.grounded;
    if (cls >= 1 && low && point.y - floor < 1.9) {
      const x = feet?.x ?? point.x, z = feet?.z ?? point.z;
      let dx = dir?.x ?? 0, dz = dir?.z ?? 1; const flat = Math.hypot(dx, dz) || 1; dx /= flat; dz /= flat;
      this.blade.set(dx, 0, dz);
      if (cls >= 2) this.kit.groundImpact(x + dx * .3, floor, z + dz * .3, 0, 1, 0, cls, time, el, floor, this.blade);
      else {
        this.kit.dustSpray(x + dx * .2, floor, z + dz * .2, dx, dz, 3, 2, .3, time, .38);
        // A heavy near the floor: a quick shockwave along it and a few chips.
        this.kit.ring(x, floor + .05, z, .3, 1.8, time, .26, 0xffffff, el.rim, .12, 'flat');
        this.kit.debris.burst(this.kit.n(3, 1), x, floor, z, 0, 1, 0, 4, .8, .07, floor, 1.2);
      }
    }
    this.impacts.push({ born: time, duration: .2 + cls * .03, size: .5 + cls * .1, energy: false, seed });
  }

  /** Energy arriving: the torn pressure shell and its ink-rimmed rays, over
   *  the same starburst a fist gets, in the technique's own colours. */
  private energy(point: THREE.Vector3, time: number, seed: number, el: Element, cls: ImpactClass, local: boolean, victim?: Fighter, floor = point.y - 1.05, anchor = 0, dir?: THREE.Vector3) {
    const slot = this.takeSlot(), radius = cls >= 3 ? .36 : cls >= 2 ? .3 : .25;
    slot.group.name = 'combat-energy-burst'; slot.group.visible = true; slot.group.position.copy(point); slot.group.quaternion.identity();
    const shell = slot.shell, u = shell.material.uniforms;
    u.uSeed.value = seed % 1000; u.uUltimate.value = 0; u.uDuration.value = .24; u.uFloor.value = -1000; u.uAge.value = 0;
    u.uTint.value.setHex(el.rim); (u.uAccent.value as THREE.Color).setHex(el.rim).multiplyScalar(.6);
    shell.visible = true; shell.scale.setScalar(radius);
    slot.pressure.visible = slot.dust.visible = slot.debris.visible = false;
    slot.rim.color.setHex(el.rim); slot.rim.opacity = .95;
    const count = Math.max(5, Math.floor(10 * Math.min(1, this.kit.budget)));
    slot.streaks.count = slot.ink.count = count; slot.streaks.visible = slot.ink.visible = true;
    for (let i = 0; i < count; i++) slot.streaks.setColorAt(i, WHITE);
    if (slot.streaks.instanceColor) slot.streaks.instanceColor.needsUpdate = true;
    this.kit.hitSpark(point.x, point.y, point.z, el, cls, time, dir, local ? 2 : 1, anchor, 'blast');
    // The dream loop: energy that lands from a special up goes off in cel clouds of its own colour (VfxKit.explosion).
    if (DREAM_IMPACT && cls >= 2) this.kit.explosion(point.x, point.y, point.z, el, cls >= 3 ? 1.5 : 1.1, time, cls >= 3 ? 12 : 8);
    if (victim?.state.grounded && cls >= 2 && point.y - floor < 1.9) this.kit.groundImpact(victim.group.position.x, floor, victim.group.position.z, 0, 1, 0, cls, time, el, floor);
    // The shell rides the body it burst on, like the spark does.
    const follow = victim, offset = follow ? new THREE.Vector3().subVectors(point, bodyCentre(follow, this.centre)) : undefined;
    this.impacts.push({ born: time, duration: .3, size: radius, energy: true, seed, slot, follow, offset });
  }

  /** A bomb going off: once per detonation, at the authoritative centre. */
  private detonate(event: CombatEvent, point: THREE.Vector3, fighterId: FighterId | undefined, el: Element, local: boolean, radius: number) {
    const key = `${event.actorId}:${event.serverTime.toFixed(5)}`;
    const center = event.origin ? new THREE.Vector3(event.origin.x, event.origin.y, event.origin.z) : point;
    const violet = fighterId === 'konta';
    if (!this.detonations.has(key)) {
      this.detonations.add(key);
      if (this.detonations.size > 64) this.detonations.delete(this.detonations.values().next().value!);
      // (A bomb the Armory casting draws goes off in its own effect: render/vfx/armory/drawn.ts.)
      if (!armoryDraws(fighterId, event.slot, event.branch, event.actorId)) this.ultimateBurst(center, event.serverTime, event.seed ?? event.id, el, violet, fighterId === 'gummy' || fighterId === 'kagari', local, radius);
    }
    if (event.kind === 'hit' && point.distanceToSquared(center) > 2.25) this.energy(point, event.serverTime, event.seed ?? event.id, el, 2, local);
  }

  /** The bomb's mass: the toon shell, the ground wave, dust lobes and debris,
   *  over the sprite burst, the rubble and the crater.
   *
   *  Round 3e (ULTFIX): drawn at the blast's own radius - the one the
   *  simulation hits with (MoveDefinition.radius) and the ring on the floor
   *  marked from the cast (signature/BlastArea) - so what goes off is what
   *  was shown, and a body whose feet are outside it is visibly outside it.
   *  It was drawn at the bomb's size (2.3 m, the Azure Foxfire's 4.6)
   *  with a shock ring out to 7-9.5 m, over blasts of 6-6.5 m. */
  private ultimateBurst(center: THREE.Vector3, time: number, seed: number, el: Element, violet: boolean, will: boolean, local: boolean, blast: number) {
    let busy = 0; for (const i of this.impacts) if (i.ultimate) busy++;
    if (busy >= 4) { const oldest = this.impacts.find(i => i.ultimate)!; this.releaseSlot(oldest); this.impacts.splice(this.impacts.indexOf(oldest), 1); }
    const slot = this.takeSlot(), radius = blast;
    slot.group.name = 'combat-ultimate-burst'; slot.group.visible = true; slot.group.position.copy(center); slot.group.quaternion.identity();
    // Match the incoming visible sphere at arrival; authority still owns the
    // unchanged hit timestamp and explosion body-centre position.
    slot.group.position.y += radius - 1.05 + .03;
    const u = slot.shell.material.uniforms;
    u.uSeed.value = seed % 1000; u.uUltimate.value = 1; u.uDuration.value = .3; u.uAge.value = 0;
    u.uTint.value.setHex(will ? 0xff4a1e : violet ? 0x8543e8 : 0x0062d9); (u.uAccent.value as THREE.Color).setRGB(.01, .22, 1);
    slot.shell.visible = true; slot.shell.scale.setScalar(radius);
    const wave = slot.pressure.material.uniforms;
    wave.uTint.value.setHex(will ? 0xfa6d32 : violet ? 0x8846ee : 0x069ecc); wave.uSeed.value = seed % 1000; wave.uDust.value = 1.35; wave.uEnergy.value = 1; wave.uReach.value = 7.8;
    // The simulator reports body centres at feet + 1.05 m; keep the crest at
    // the corresponding ground projection, even on a raised platform.
    // The ground wave and the dust lobes are not drawn: in the energy's blue
    // the wave's mottling read as puddles of water, and the lobes as flat
    // cream blobs. A crater, a ring and three-tone smoke carry the ground.
    slot.pressure.position.set(0, -radius + .015, 0); slot.pressure.visible = false;
    slot.dust.material.uniforms.uSeed.value = seed % 1000; slot.dust.visible = false; slot.debris.visible = true;
    slot.rim.color.set(0xffffff); slot.rim.opacity = 1;
    const count = Math.max(5, Math.floor(22 * Math.min(1, this.kit.budget)));
    slot.streaks.count = slot.ink.count = count; slot.streaks.visible = slot.ink.visible = true;
    for (let i = 0; i < count; i++) slot.streaks.setColorAt(i, this.scratchColor.set(i % 3 === 0 ? (violet ? 0x8e55ff : will ? 0xff5a2a : 0x159bff) : will ? 0xffd9b0 : 0xc3f6ff));
    if (slot.streaks.instanceColor) slot.streaks.instanceColor.needsUpdate = true;
    const floor = center.y - 1.05;
    this.kit.hitSpark(center.x, center.y + .6, center.z, el, 3, time, undefined, local ? 3 : 2);
    if (DREAM_IMPACT) this.kit.explosion(center.x, floor + radius * .45, center.z, el, Math.min(4, radius * .7), time, 16);
    this.kit.groundImpact(center.x, floor, center.z, 0, 1, 0, 3, time, el, floor);
    // The crater and the shock ring end where the blast does (the ring sprite
    // draws its band at 0.86 of its size).
    this.kit.scorch(center.x, floor, center.z, 0, 1, 0, radius * 1.05, time, el.light);
    this.kit.ring(center.x, floor + .08, center.z, 1, radius / .86, time, .6, 0xffffff, el.rim, .14, 'flat');
    for (let i = 0, n = this.kit.n(10, 4); i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * .4, c = Math.cos(a), s = Math.sin(a), v = 2.5 + Math.random() * 2;
      const out = radius * .6;
      this.kit.smoke(center.x + c * out, floor + .5, center.z + s * out, c * v, .8 + Math.random(), s * v, (violet ? 1.9 : 1.3) + Math.random() * .5, time + Math.random() * .05, .55);
    }
    this.kit.pulse(center.x, center.y + 2.2, center.z, el.light, 30, 14, time, .9, 3);
    if (local) { this.frame(1); this.chroma(1); }
    this.impacts.push({ born: time, duration: 1.25, size: radius, energy: true, seed, slot, ultimate: true });
  }

  /** A body driven into a wall: rubble out of the wall, a crack in it, and a
   *  ring in its plane. The wall's normal is the way the body was travelling,
   *  reversed; the event carries only where it stuck. */
  private wallSplat(event: CombatEvent, fighters?: ReadonlyMap<string, Fighter>) {
    const o = event.origin!, body = fighters?.get(event.actorId);
    let nx = 1, nz = 0;
    if (body) {
      const v = (body.velocity as THREE.Vector3 | undefined) ?? this.direction.set(0, 0, 0), s = Math.hypot(v.x, v.z);
      if (s > .5) { nx = -v.x / s; nz = -v.z / s; } else { nx = Math.sin(body.state.yaw); nz = Math.cos(body.state.yaw); }
    }
    const x = o.x - nx * .45, y = o.y + 1.05, z = o.z - nz * .45, time = event.serverTime;
    this.kit.hitSpark(x, y, z, PHYSICAL, 1, time, this.blow.set(nx, .2, nz).normalize());
    this.kit.groundImpact(x, y, z, nx, 0, nz, 2, time, undefined, o.y);
    this.kit.pulse(x + nx * 1.3, y + .3, z + nz * 1.3, 0xffe2b0, 6, 7, time, .3);
  }

  /** An iai draw: the swordsman is through the target before the cut shows.
   *  The dash is drawn as a blur - three poses of him strung back along the
   *  line he ran - and the cut as one white-hot line down that line, with
   *  the wind torn off it and the floor kicked up where he set off. */
  private iai(event: CombatEvent, fighters?: ReadonlyMap<string, Fighter>) {
    const o = event.origin!, e = event.endpoint!, time = event.serverTime, kit = this.kit, sp = kit.sparks.spec;
    const dx = e.x - o.x, dy = e.y - o.y, dz = e.z - o.z, length = Math.hypot(dx, dy, dz);
    if (length < .5) return;
    const ux = dx / length, uy = dy / length, uz = dz / length, el = elementFor(event.fighter, event.slot, false, 0, event.branch);
    const body = fighters?.get(event.actorId);
    if (body) {
      // The ghosts are the pose he cut in, set back along the dash.
      for (let i = 1, n = kit.n(3, 2); i <= n; i++) {
        const back = length * i / (n + 1);
        kit.ghosts.spawn(body, el.light, time + i * .012, .18 + .04 * (n - i), .75 - i * .12, this.head.set(-ux * back, 0, -uz * back));
      }
    }
    // The cut: a line as long as the dash at chest height, leading at the
    // swordsman and trailing back to where he set off, over a soft glow.
    const y = Math.min(o.y, e.y) + .15;
    sp.reset(SPRITE.streak, time, .3).pos(e.x, y, e.z).velocity(ux * .01, uy * .01, uz * .01);
    sp.orient = ORIENT.velocity; sp.sized(.05, .03, .5); sp.stretch = length / .05; sp.hot(0xffffff, 2).cool(el.rim, .6); kit.sparks.emit();
    sp.reset(SPRITE.glow, time, .26).pos((o.x + e.x) * .5, y, (o.z + e.z) * .5).sized(.22, .3, .3).hot(el.rim, 1.2);
    sp.orient = ORIENT.axial; sp.axis(ux, uy, uz); sp.stretch = length * .5 / .3; kit.sparks.emit();
    for (let i = 0, n = kit.n(8, 3); i < n; i++) {
      const t = Math.random() * length;
      sp.reset(SPRITE.streak, time, .14 + Math.random() * .1).pos(o.x + ux * t, y + (Math.random() - .5) * .9, o.z + uz * t).velocity(ux * 16, 0, uz * 16);
      sp.orient = ORIENT.velocity; sp.sized(.018, .01, .5); sp.stretch = 3; sp.trail = .05; sp.drag = 6; sp.hot(0xffffff, 1.4).cool(el.rim, 0); kit.sparks.emit();
    }
    if (!body || body.state.grounded) kit.dustSpray(o.x, body ? body.group.position.y : o.y - 1.05, o.z, -ux, -uz, 4, 3, .45, time, .4, .9);
    kit.pulse(e.x - ux * length * .5, y + 1, e.z - uz * length * .5, el.light, 6, 7, time, .25, 1.5);
    if (this.localId !== undefined && event.actorId === this.localId) this.screen?.speedLines(1);
  }

  /** Stepping out of a blow: a ghost left standing where they were and a
   *  flash where they come back, behind the attacker. */
  private vanish(event: CombatEvent, fighters?: ReadonlyMap<string, Fighter>) {
    const body = fighters?.get(event.actorId), time = event.serverTime;
    const tint = body ? ghostTint(body.state.fighter, !!body.state.awakened) : 0xbfe6ff;
    if (body && event.origin) {
      const offset = this.head.set(event.origin.x - body.group.position.x, 0, event.origin.z - body.group.position.z);
      this.kit.ghosts.spawn(body, tint, time, .3, .9, offset);
    }
    const at = event.endpoint ?? body?.group.position;
    if (at) {
      const y = at.y + 1.05, sp = this.kit.sparks.spec;
      sp.reset(SPRITE.core, time, .1).pos(at.x, y, at.z).sized(.5, 1.1, .3).hot(0xffffff, 1.8).cool(tint); this.kit.sparks.emit();
      sp.reset(SPRITE.flare, time, .18).pos(at.x, y, at.z).sized(.9, 1.8, .2).hot(0xffffff, 1.1).cool(tint); this.kit.sparks.emit();
      this.kit.ring(at.x, y, at.z, .3, 2.2, time, .28, 0xffffff, tint, .1);
      this.kit.streaks(at.x, y, at.z, { spike: 0xffffff, rim: tint, light: tint, ink: 0 }, this.kit.n(10, 4), 9, .02, time);
      this.kit.pulse(at.x, y, at.z, tint, 2.5, 6, time, .25);
    }
    if (event.origin) this.kit.dustRing(event.origin.x, event.origin.y, event.origin.z, 5, .2, 2.5, .8, time, .5);
    if (this.localId !== undefined && (event.actorId === this.localId || event.targetId === this.localId)) this.moment(.75);
  }

  /** Lock combat's preview: a blow of the player's string, or on them: a white bloom about 30-40% of frame height
   *  for 4-6 frames (130-200 ms), plus a thin expanding ring and radial streaks, on every light hit, where it used to
   *  flash for 1-2 frames. A finisher's is the big one: a bloom that
   *  fills the pair, a wide shockwave ring and a pulse of light. */
  private lockBlow(point: THREE.Vector3, el: Element, time: number, victim: Fighter | undefined, finisher: boolean, thrower?: Fighter) {
    const sp = this.kit.sparks.spec, anchor = this.kit.anchorTo(victim, time, .4);
    // The speed of the blow (the critic wanted the limbs smeared into 150-200 px streaks on every strike; ours were
    // "crisp with no motion blur"): two fading copies of the thrower trailing back along the blow.
    if (thrower) {
      const tint = ghostTint(thrower.state.fighter, !!thrower.state.awakened), at = thrower.group.position;
      const bx = point.x - at.x, bz = point.z - at.z, n = Math.hypot(bx, bz) || 1;
      for (const [back, alpha, life] of LOCK_STREAKS) this.kit.ghosts.spawn(thrower, tint, time, life * (finisher ? 1.4 : 1), alpha, this.head.set(-bx / n * back, 0, -bz / n * back).clone());
    }
    sp.reset(SPRITE.flare, time, finisher ? .34 : .26).pos(point.x, point.y, point.z).sized(finisher ? 2 : .8, finisher ? 5 : 1.6, .3).hot(0xffffff, finisher ? 2.4 : 1.25).cool(el.rim); sp.anchor = anchor; this.kit.sparks.emit();
    if (finisher) { sp.reset(SPRITE.core, time, .2).pos(point.x, point.y, point.z).sized(1.2, 2.6, .3).hot(0xffffff, 2.6).cool(0xffffff); sp.anchor = anchor; this.kit.sparks.emit(); }
    this.kit.ring(point.x, point.y, point.z, .2, finisher ? 4.2 : 1.3, time, finisher ? .36 : .26, 0xffffff, el.rim, finisher ? .12 : .05);
    this.kit.streaks(point.x, point.y, point.z, { spike: 0xffffff, rim: el.rim, light: el.light ?? el.rim, ink: 0 }, this.kit.n(finisher ? 14 : 6, 3), finisher ? 12 : 6, .02, time);
    if (finisher) {
      // The climax, brighter than anything the string threw before it: a light that fills the pair, the room behind
      // them blurred toward the blow (GameRenderer.impactBlur, both bodies kept sharp), and the colour fringe.
      this.kit.pulse(point.x, point.y, point.z, 0xffffff, 10, 11, time, .36, 3);
      if (time - this.lastBlur > .3) { this.lastBlur = time; this.screen?.impactBlur?.(.9, point, victim ? [victim] : []); }
      this.chroma(.8);
    }
  }

  /** Lock combat (game/lockCombat.ts): a round's last blow on the player and the window it opens - a gold burst as the
   *  blow lands, then a ring closing on the body until the escape window shuts (`due`): guard before it closes and they
   *  vanish out. */
  private lockGap(event: CombatEvent, fighters?: ReadonlyMap<string, Fighter>) {
    if (this.localId === undefined || event.targetId !== this.localId) return;
    const body = fighters?.get(event.targetId);
    if (!body) return;
    const time = event.serverTime, c = bodyCentre(body, this.centre), anchor = this.kit.anchorTo(body, time, .6);
    const shuts = Math.max(LOCK_ESCAPE_WINDOW, (event.due ?? time + LOCK_ESCAPE_WINDOW) - time);
    const sp = this.kit.sparks.spec;
    sp.reset(SPRITE.flare, time, .16).pos(c.x, c.y, c.z).sized(.8, 2.2, .3).hot(0xffffff, 1.4).cool(LOCK_GOLD); sp.anchor = anchor; this.kit.sparks.emit();
    this.kit.ring(c.x, c.y, c.z, .4, 2.6, time, .26, 0xffffff, LOCK_GOLD, .12);
    // The window: closing, gold to white, shut when it is.
    sp.reset(SPRITE.ring, time, shuts).pos(c.x, c.y, c.z).sized(2.6, .55, .7).hot(LOCK_GOLD, 1.5).cool(0xffffff, .2); sp.anchor = anchor; this.kit.sparks.emit();
    this.kit.pulse(c.x, c.y, c.z, LOCK_GOLD, 3, 6, time, .3);
  }

  /** A guard on the beat: GuardFx draws the burst on the shell (Round 5, PARRY). The local player's own parry - made
   *  or suffered - prints the paper impact frame, the hard flash of the read (rationed by `frame`, off under
   *  prefers-reduced-motion). */
  private perfectGuard(event: CombatEvent, _fighters?: ReadonlyMap<string, Fighter>) {
    // The paper frame held a beat (the feel pass's hold). Round 5 (GUARD): no zoom blur - it smeared the
    // orb's flare across the frame; the orb flaring and snapping outward is the parry (vfx/GuardFx).
    if (this.localId !== undefined && (event.actorId === this.localId || event.targetId === this.localId)) this.frame(.85, IMPACT_FRAME_HOLD * .5);
    // A parried shot is destroyed at the guard: it flies no further than the parry.
    for (const cast of this.casts) if (cast.event.actorId === event.actorId && cast.event.slot === event.slot && cast.released && cast.contactAt === undefined) cast.contactAt = event.serverTime;
  }

  /** A fighter going down for good: the biggest burst there is. */
  private knockout(event: CombatEvent, fighters?: ReadonlyMap<string, Fighter>) {
    const victim = event.targetId ? fighters?.get(event.targetId) : undefined, killer = fighters?.get(event.actorId);
    if (!victim) return;
    const p = victim.group.position, time = event.serverTime;
    const el = killer ? elementFor(killer.state.fighter, 'ultimate', !!killer.state.awakened) : PHYSICAL;
    const local = this.localId !== undefined && (event.actorId === this.localId || event.targetId === this.localId);
    const self = this.localId !== undefined ? fighters?.get(this.localId) : undefined;
    const near = !!self && self.group.position.distanceTo(p) < 16;
    const c = bodyCentre(victim, this.centre), anchor = this.kit.anchorTo(victim, time, .6);
    if (!local && !near) { this.kit.hitSpark(c.x, c.y + .2, c.z, el, 2, time, undefined, 1, anchor); return; }
    this.kit.hitSpark(c.x, c.y + .2, c.z, el, 3, time, undefined, 3, anchor);
    const sp = this.kit.sparks.spec;
    sp.reset(SPRITE.ring, time + .05, .45).pos(c.x, c.y + .2, c.z).sized(.8, 5, .6).hot(0xffffff, 1.3).cool(el.rim, .1); sp.anchor = anchor; this.kit.sparks.emit();
    this.kit.groundImpact(p.x, p.y, p.z, 0, 1, 0, 3, time, el, p.y);
    this.kit.pulse(c.x, c.y + 1.4, c.z, 0xffffff, 14, 12, time, .7, 3);
    // The feel pass, iteration eleven: the knockout holds its ink frame as an ultimate's last blow does.
    if (local) { this.frame(1, IMPACT_FRAME_HOLD); this.chroma(1); }
  }

  /** The screen's answers, throttled: a string of hits must read as a
   *  string of blows, not as a strobe. */
  private frame(strength: number, hold = 0) {
    const now = performance.now() / 1000;
    if (now - this.lastFrame < .4) { if (hold > 0) this.screen?.extendImpact?.(hold); return; }
    this.lastFrame = this.lastPanel = now; this.screen?.impactFrame(Math.min(1, strength * Math.max(.5, this.kit.density)), undefined, hold);
  }
  /** A big moment's panel: only once PANEL_REST has passed without one. */
  private moment(strength: number) {
    if (performance.now() / 1000 - this.lastPanel < PANEL_REST) return;
    this.frame(strength);
  }
  private chroma(amount: number) {
    const now = performance.now() / 1000;
    if (now - this.lastChroma < .12) return;
    this.lastChroma = now; this.screen?.chromaticPulse(Math.min(1, amount * Math.max(.5, this.kit.density)));
  }

  private windups: { actorId: string; born: number; contact: number; el: Element; next: number }[] = [];
  private windup(event: CombatEvent, fighters?: ReadonlyMap<string, Fighter>) {
    const slot = event.slot!, fighterId = event.fighter!, actor = fighters?.get(event.actorId);
    if (!actor) return;
    const move = slot === 'light' && (event.chain ?? 0) > 0 ? rushMove(fighterId, event.chain!, !!actor.state.awakened) : thrown(fighterId, slot, event.branch, false, !!actor.state.awakened);
    const big = !!event.branch || slot === 'heavy' || slot === 'light' && (event.chain ?? 0) >= 3;
    if (!big || move.style !== 'melee' || !(move.contacts[0] > .14)) return;
    if (this.windups.length > 8) this.windups.shift();
    this.windups.push({ actorId: event.actorId, born: event.serverTime, contact: event.serverTime + move.contacts[0], el: elementFor(fighterId, slot, !!actor.state.awakened, event.chain ?? 0, event.branch), next: 0 });
  }
  private drawWindups(time: number, fighters: Map<string, Fighter>) {
    let kept = 0;
    for (const w of this.windups) {
      const body = fighters.get(w.actorId);
      if (!body || time > w.contact) continue;
      this.windups[kept++] = w;
      if (time < w.next || time < w.born) continue;
      w.next = time + 1 / 30;
      const k = THREE.MathUtils.clamp((time - w.born) / Math.max(.05, w.contact - w.born), 0, 1), sp = this.kit.sparks.spec;
      const p = body.strikePoint(this.limb);
      sp.reset(SPRITE.core, time, .07).pos(p.x, p.y, p.z).sized(.08 + .14 * k, .1 + .18 * k, .3).hot(w.el.spike, 1.2 + k).cool(w.el.rim); sp.bias = .2; this.kit.sparks.emit();
      for (let i = 0; i < 2; i++) {
        this.direction.set(Math.random() - .5, Math.random() * .8 - .2, Math.random() - .5).normalize();
        const r = .7 + Math.random() * .5, v = r / .12;
        sp.reset(SPRITE.streak, time, .12).pos(p.x + this.direction.x * r, p.y + this.direction.y * r, p.z + this.direction.z * r).velocity(-this.direction.x * v, -this.direction.y * v, -this.direction.z * v);
        sp.orient = ORIENT.velocity; sp.sized(.02, .012, .5); sp.stretch = 3; sp.trail = .03; sp.bias = .15; sp.hot(w.el.spike, 1.3).cool(w.el.rim, 0); this.kit.sparks.emit();
      }
    }
    this.windups.length = kept;
  }

  private trailSeen = new Map<string, { x: number; y: number; z: number; at: number; next: number }>();
  private launchTrails(time: number, fighters: Map<string, Fighter>) {
    if (!DREAM_IMPACT) return;
    if (this.trailSeen.size > 40) for (const id of this.trailSeen.keys()) if (!fighters.has(id)) this.trailSeen.delete(id);
    for (const [id, body] of fighters) {
      const c = bodyCentre(body, this.head), was = this.trailSeen.get(id);
      if (!was) { this.trailSeen.set(id, { x: c.x, y: c.y, z: c.z, at: time, next: 0 }); continue; }
      const gap = time - was.at;
      if (gap <= 1e-4) continue;
      const vx = (c.x - was.x) / gap, vy = (c.y - was.y) / gap, vz = (c.z - was.z) / gap;
      was.x = c.x; was.y = c.y; was.z = c.z; was.at = time;
      const a = body.state.action, flung = a === 'launched' || a === 'knockdown' || a === 'splat' || (a === 'hurt' || a === 'flinch') && !body.state.grounded;
      // A fighter moving under their own power - a dash, a chase - leaves pale strokes instead, fewer and only when fast.
      const driven = !flung && (a === 'dash' || a === 'light' || a === 'heavy' || a === 'jump');
      const speed = Math.hypot(vx, vy, vz);
      if (!(flung && speed >= 5.5 || driven && speed >= 8.5) || speed > 60 || time < was.next) continue;
      was.next = time + (flung ? 1 / 40 : 1 / 28);
      const ux = vx / speed, uy = vy / speed, uz = vz / speed, sp = this.kit.sparks.spec;
      // Somewhere across the body's width, square to its path.
      this.direction.set(Math.random() - .5, Math.random() - .5, Math.random() - .5);
      this.direction.addScaledVector(this.limb.set(ux, uy, uz), -this.direction.dot(this.limb)).normalize().multiplyScalar(.15 + Math.random() * .4);
      const len = Math.min(3.2, .6 + speed * .13), half = len * .5, back = .3 + Math.random() * .5, w = .016 + Math.random() * .012;
      sp.reset(SPRITE.bolt, time, .14 + Math.random() * .08).pos(c.x + this.direction.x - ux * (back + half), c.y + this.direction.y - uy * (back + half), c.z + this.direction.z - uz * (back + half));
      sp.orient = ORIENT.axial; sp.axis(ux, uy, uz); sp.sized(w, w, 1); sp.stretch = half / w;
      if (flung) sp.hot(0x1b2440, .3).cool(0x0b1022, .82); else sp.hot(0xeaf4ff, .3).cool(0xeaf4ff, .5);
      this.kit.sparks.emit();
    }
  }

  /** Blows that reached a body where it is drawn (Fighter.touchLog), marked
   *  on that frame: the spark and the floor's answer, as `contact` would
   *  draw them a network delay later. A guarded one is left to its event,
   *  which says what the guard did. */
  private markTouches(time: number, fighters: Map<string, Fighter>) {
    for (const mark of Fighter.touchLog) {
      if (mark.serial <= this.touchSeen) continue;
      this.touchSeen = mark.serial;
      if (mark.guarded) continue;
      const victim = fighters.get(mark.victim), source = fighters.get(mark.attacker);
      if (!victim) continue;
      const awakened = !!source?.state.awakened;
      // The swing a touch came from is still the attacker's action on the frame it lands: a combo ender's is its own
      // move and lands in its own element (game/combos.ts), not as its slot's.
      const ss = source?.state, branch = ss && ss.action === mark.slot && (mark.seq === undefined || ss.actionSeq === undefined || ss.actionSeq === mark.seq) ? ss.branch : undefined;
      const move = mark.slot === 'light' && mark.chain > 0 ? rushMove(mark.fighter, mark.chain, awakened) : thrown(mark.fighter, mark.slot, branch, awakened, awakened);
      const cls = impactClass({ id: 0, kind: 'hit', serverTime: time, actorId: mark.attacker, slot: mark.slot, chain: mark.chain, damage: mark.damage, branch }, move);
      const el = elementFor(mark.fighter, mark.slot, awakened, mark.chain, branch);
      const local = this.localId !== undefined && (mark.attacker === this.localId || mark.victim === this.localId);
      this.veil.struck(mark.victim, time, DREAM_IMPACT && !!hitTier(mark.slot, branch, mark.chain));
      const point = this.centre.set(mark.x, mark.y, mark.z), dir = this.blow.set(mark.hx, 0, mark.hz);
      this.melee(point, el, cls, time, dir, victim, victim.group.position.y, local, mark.serial * 7919, this.kit.anchorTo(victim, time, .5), !!source?.armed, hitTier(mark.slot, branch, mark.chain), MAGIC_MELEE.has(mark.fighter), OWN_STEEL.has(mark.fighter));
      const key = `${mark.attacker}>${mark.victim}`, pending = this.touchSparks.get(key), spark = { at: time, seq: mark.seq ?? -1, index: mark.index ?? -1 };
      if (pending) { pending.push(spark); if (pending.length > 8) pending.shift(); } else this.touchSparks.set(key, [spark]);
      if (this.touchSparks.size > 64) this.touchSparks.delete(this.touchSparks.keys().next().value!);
    }
  }
  /** Whether a blow's spark was drawn already, when it reached the body (see
   *  TOUCH_SPARK): the pair's touch of the event's own swing and contact, or,
   *  for an event that carries no swing, the oldest of the pair's inside
   *  TOUCH_SPARK. Taken, so it is claimed once. */
  private claimTouchSpark(event: CombatEvent) {
    const pending = this.touchSparks.get(`${event.actorId}>${event.targetId}`);
    if (!pending) return false;
    while (pending.length && event.serverTime - pending[0].at > TOUCH_KEPT) pending.shift();
    let k = 0;
    if (event.actionSeq !== undefined) {
      const index = event.contactIndex ?? 0;
      while (k < pending.length && !(pending[k].seq === event.actionSeq && pending[k].index === index)) k++;
    } else {
      while (k < pending.length && event.serverTime - pending[k].at > TOUCH_SPARK) k++;
      if (k < pending.length && pending[k].at - event.serverTime > .1) return false;
    }
    if (k >= pending.length) return false;
    pending.splice(k, 1);
    return true;
  }
  /** A rush finisher, drawn as its fighter's own (see FINISHERS), or as its awakened form's where that throws another. */
  private finisherAccent(fighter: FighterId, point: THREE.Vector3, dir: THREE.Vector3 | undefined, victim: Fighter | undefined, floor: number, time: number, local: boolean, el: Element, awakened = false) {
    const accent = (awakened ? FORM_FINISHERS[fighter] : undefined) ?? FINISHERS[fighter], kit = this.kit, sp = kit.sparks.spec;
    let hx = dir?.x ?? 0, hz = dir?.z ?? 1; const flat = Math.hypot(hx, hz) || 1; hx /= flat; hz /= flat;
    const anchor = kit.anchorTo(victim, time, .45);
    const c = victim ? bodyCentre(victim, this.head) : this.head.copy(point);
    const up = this.limb.set(0, 1, 0), along = this.blade.set(hx, 0, hz);
    switch (accent.shape) {
      case 'own': break;
      case 'shockwave':
        // Skyfall Smash: a ki shockwave in the plane of the blow, a ring facing
        // the lens, and streaks thrown on along it.
        kit.ring(point.x, point.y, point.z, .2, 2.6, time, .32, 0xffffff, el.rim, .12, 'plane', hx, 0, hz);
        kit.ring(point.x, point.y, point.z, .3, 1.8, time + .04, .26, el.spike, el.rim, .1);
        kit.streaks(point.x, point.y, point.z, el, kit.n(14, 5), 16, .03, time, along, 1.6, 2, 0, anchor);
        break;
      case 'hammer':
        // The Double Axe Handle drives down: the floor takes it.
        kit.groundImpact(c.x, floor, c.z, 0, 1, 0, 3, time, el, floor);
        kit.ring(c.x, floor + .06, c.z, .3, 3.4, time, .4, 0xffffff, el.rim, .16, 'flat');
        kit.streaks(point.x, point.y, point.z, el, kit.n(10, 4), 11, .026, time, up.set(0, -1, 0), 1.3, 9, 0, anchor);
        break;
      case 'smoke':
        // Up You Go!!: the clones that threw it pop round the body.
        for (let i = 0; i < 4; i++) {
          const a = i * Math.PI / 2 + .4, cs = Math.cos(a), sn = Math.sin(a);
          kit.smoke(c.x + cs * .7, c.y + (i % 2 ? .3 : -.2), c.z + sn * .7, cs * 1.5, .8, sn * 1.5, .9, time + i * .03, .45);
        }
        kit.ring(c.x, c.y, c.z, .3, 2.2, time, .3, 0xffffff, el.rim, .12);
        break;
      case 'bolt':
        // Lightning up and down the body, and a flash on the blow.
        for (let i = 0; i < 3; i++) {
          this.centre.set(c.x + (Math.random() - .5) * .5, c.y - .7, c.z + (Math.random() - .5) * .5);
          this.direction.set(c.x + (Math.random() - .5) * .5, c.y + .9, c.z + (Math.random() - .5) * .5);
          kit.crackle(this.centre, this.direction, .2, el, kit.n(8, 3), time + i * .02);
        }
        sp.reset(SPRITE.flare, time, .16).pos(point.x, point.y, point.z).sized(.6, 1.6, .2).hot(0xffffff, 1.6).cool(el.rim); sp.anchor = anchor; kit.sparks.emit();
        break;
      case 'spiral':
        // The Riptide Fist: the twist, rings turning on along the blow.
        for (let i = 0; i < 3; i++) kit.ring(point.x + hx * i * .35, point.y, point.z + hz * i * .35, .15, .9 + i * .35, time + i * .035, .22, 0xffffff, el.rim, .1, 'plane', hx, 0, hz);
        kit.streaks(point.x, point.y, point.z, el, kit.n(10, 4), 13, .026, time, along, 1.4, 3, 0, anchor);
        break;
      case 'tornado':
        // Dust Devil: a spiral of cuts rising round the body.
        for (let i = 0; i < 4; i++) kit.ring(c.x, floor + .3 + i * .45, c.z, .4, 1.4 + i * .25, time + i * .04, .3, 0xffffff, el.rim, .08, 'flat');
        kit.streaks(c.x, floor + .4, c.z, el, kit.n(12, 5), 9, .024, time, up, 1.5, -2, 0, anchor);
        break;
      case 'rising':
        // The Flambe Kick: a column of fire out from under the body.
        for (let i = 0, n = kit.n(6, 3); i < n; i++) kit.smoke(c.x + (Math.random() - .5) * .4, floor + .2 + i * .25, c.z + (Math.random() - .5) * .4, 0, 4 + i, 0, .6 + i * .05, time + i * .02, .4, 0xffb347, 0xd9481e);
        kit.streaks(c.x, floor + .3, c.z, el, kit.n(12, 5), 12, .028, time, up, 1.8, -4, 0, anchor);
        break;
      case 'flurry':
        // A spirit's cry: its fists land all at once, round the blow.
        for (let i = 0, n = kit.n(6, 3); i < n; i++) kit.hitSpark(point.x + (Math.random() - .5) * .6, point.y + (Math.random() - .5) * .6, point.z + (Math.random() - .5) * .6, el, 0, time + i * .025, along, 1, anchor);
        break;
      case 'crescent':
        // The Accent Scorch: a crescent across the body, and its dark.
        sp.reset(SPRITE.ring, time, .3).pos(c.x, c.y, c.z).sized(.5, 2.1, .6).hot(0xffffff, 1.3).cool(el.rim, .12); sp.orient = ORIENT.plane; sp.axis(hx, 0, hz); sp.anchor = anchor; kit.sparks.emit();
        kit.smoke(c.x - hx * .3, c.y, c.z - hz * .3, hx * 2, .5, hz * 2, 1.2, time, .45, 0x3a0b12, 0x120306);
        break;
      case 'cross':
        // Rekka: a cross of fire.
        for (const tilt of [1, -1]) for (const side of [1, -1]) kit.streaks(point.x, point.y, point.z, el, kit.n(6, 2), 13, .03, time, this.direction.set(-hz * tilt * side, side, hx * tilt * side).normalize(), 2.2, 0, 0, anchor);
        kit.pulse(point.x, point.y, point.z, el.light, 16, 8, time, .3, 2);
        break;
      case 'room':
        // Gurney Lift: the ROOM on the floor under the body as it lifts.
        kit.ring(c.x, floor + .05, c.z, .5, 2.6, time, .45, 0xffffff, el.rim, .2, 'flat');
        kit.streaks(c.x, floor + .2, c.z, el, kit.n(10, 4), 10, .02, time, up, 2, -1, 0, anchor);
        break;
      case 'red':
        // Nova, the repelling burst.
        sp.reset(SPRITE.core, time, .12).pos(point.x, point.y, point.z).sized(.4, 1, .3).hot(0xffffff, 2.2).cool(el.rim); sp.anchor = anchor; kit.sparks.emit();
        kit.ring(point.x, point.y, point.z, .2, 2.8, time, .3, el.spike, el.rim, .08);
        kit.pulse(point.x, point.y, point.z, el.light, 24, 10, time, .35, 2);
        break;
      case 'crater':
        // The Slab Smash: the floor breaks under the body.
        kit.groundImpact(c.x, floor, c.z, 0, 1, 0, 3, time, el, floor);
        kit.debris.burst(kit.n(10, 4), c.x, floor, c.z, 0, 1, 0, 8, .9, .15, floor, 2.2);
        kit.ring(c.x, floor + .06, c.z, .5, 4.2, time, .45, 0xffffff, el.rim, .2, 'flat');
        break;
    }
    if (!local || !this.screen) return;
    if (accent.screen === 'speed') this.screen.speedLines(1);
    else if (accent.screen === 'fringe') this.chroma(1);
    else this.screen.techniqueGrade?.(el.light, .35, .25, point, 2.5);// round 3c: a pool round the finisher, not the whole frame
  }

  /** A foot coming down, from main.ts's step drain. */
  footstep(step: { x: number; y: number; z: number; speed: number }, time: number) { this.motion.footstep(this.kit, step.x, step.y, step.z, step.speed, time); }

  private removeCast(cast: CastView) { FLIGHTS.delete(flightKey(cast)); cast.group.removeFromParent();cast.ownedMaterial?.dispose(); cast.streams?.dispose(); for(const palm of cast.palmCharges??[])palm.removeFromParent(); }

  /** Round 8 (ULT AIM): a bomb aimed as it leaves the hand (MoveDefinition.aimOnRelease), drawn where the simulation
   *  will set it down (game/bombAim.ts; ArenaSimulation.aimBomb, homeBomb). Through the wind-up: at where the body it is
   *  thrown at will be when it comes down, if it is in reach. From the release - the release's own point once its word
   *  is in - after that body at BOMB_HOME metres a second, never more than BOMB_DRIFT from where it was let go, until
   *  BOMB_COMMIT before it lands. Its ring on the floor (BlastAreas) goes where it goes and stops when it
   *  does: whoever it is thrown at can see it on them, and when it has stopped following. A hit's burst is still the
   *  server's own point (detonate); a miss's, where this sets the flight down. */
  private followBomb(c: CastView, move: MoveDefinition, actor: Fighter | undefined, fighters: Map<string, Fighter>, age: number, dt: number, fired: boolean) {
    if (!fired && !c.aimedDone) c.foe = actor?.state.target ?? undefined;
    const foe = c.foe ? fighters.get(c.foe) : undefined;
    if (foe?.state.alive) {
      // Its middle - over the floor under it while it is off the floor (bombTarget).
      const at = this.bombAt.copy(foe.group.position);
      if (foe.state.grounded) c.foeFloor = at.y;
      at.y = (foe.state.grounded ? at.y : c.foeFloor ?? c.floor) + 1.05 * (foe.state.size ?? 1);
      const moving = foe.velocity as THREE.Vector3 | undefined, vx = moving?.x ?? 0, vz = moving?.z ?? 0, speed = move.speed ?? 20;
      if (!fired && !c.aimedDone) {
        // Where it will be let go at (aimBomb): thrown at them from inside its range and a stride (shotTarget), set
        // down inside its range; eased, so the ring does not shake with the body's every step.
        if (actor && actor.group.position.distanceTo(foe.group.position) <= move.range + 2) {
          const aim = this.bombAim;
          bombLead(c.start, at, vx, vz, speed, aim);
          inRange(aim, actor.group.position, move.range);
          c.end.lerp(aim, 1 - Math.exp(-dt * 14));
          c.travel = c.start.distanceTo(c.end) / speed;
        }
      } else {
        const from = c.aimed ?? (c.homeFrom ??= c.end.clone()), left = c.release + c.travel - age;
        if (left > BOMB_COMMIT) {
          homeStep(c.end, homeWant(at, vx, vz, left, this.bombAim), BOMB_HOME, dt, from);
          inRange(c.end, c.start, move.range);
        }
      }
    }
    this.blast.move(c.event.id, c.end.x, c.end.y - 1.05, c.end.z, c.event.serverTime + c.release + c.travel);
  }

  /** A shot that reached the end of its flight without touching anyone
   *  still goes off: against the wall it hit, on the floor, or in the air. */
  private miss(c: CastView, move: MoveDefinition, time: number) {
    if ((isRoseEmpress(c.event.fighter)||isKuzuChainsaw(c.event.fighter)||isShakugoMagma(c.event.fighter)||isShanxiaoRampage(c.event.fighter)||rosterFlight(c.event.fighter,c.event.slot,c.event.branch,c.event.actorId)||isAmpereSurge(c.event.fighter)||isPyroclastExplosions(c.event.fighter)||isFullBeamPressure(c.event.fighter))) return;
    const fighterId = c.event.fighter!, slot = c.event.slot!, el = elementFor(fighterId, slot, false, 0, c.event.branch);
    if (clockHandKnives(c.event)) { this.kit.streaks(c.end.x, c.end.y, c.end.z, el, this.kit.n(6, 3), 5, .015, time); this.kit.ring(c.end.x, c.end.y, c.end.z, .1, .6, time, .15, 0xffffff, el.rim, 0); return; }
    if (move.style === 'bomb') {
      this.ultimateBurst(this.head.copy(c.end), time, c.event.seed ?? c.event.id, el, fighterId === 'konta', fighterId === 'gummy' || fighterId === 'kagari', this.localId === c.event.actorId, move.radius);
      return;
    }
    const cls: ImpactClass = move.damage >= 115 ? 2 : move.damage >= 50 ? 1 : 0;
    const floorHit = c.end.y - c.floor < .45;
    this.kit.hitSpark(c.end.x, c.end.y, c.end.z, el, c.surface ? cls : Math.max(0, cls - 1) as ImpactClass, time);
    if (c.surface) {
      let nx = 0, ny = 1, nz = 0;
      if (!floorHit) { this.beamDir.copy(c.end).sub(c.start).setY(0); if (this.beamDir.lengthSq() < 1e-6) this.beamDir.set(0, 0, 1); this.beamDir.normalize(); nx = -this.beamDir.x; ny = 0; nz = -this.beamDir.z; }
      this.kit.groundImpact(c.end.x, floorHit ? c.floor : c.end.y, c.end.z, nx, ny, nz, Math.max(1, cls) as ImpactClass, time, el, c.floor);
      if (cls >= 1 && !FLIGHT_DRESSED.has(fighterId)) this.kit.scorch(c.end.x, floorHit ? c.floor : c.end.y, c.end.z, nx, ny, nz, 1.2 + cls * .5, time, el.light);
    }
  }

  update(time: number, dt: number, fighters: Map<string, Fighter>) {
    // How far the timeline has handed its events over (see LANDED.pair).
    LANDED.clock = time;
    // Every body is drawn by now: the blows inside them are settled before
    // anything is placed on them (see Fighter.settleContacts).
    Fighter.settleContacts();
    if (this.settings) { this.kit.density = this.settings.effects; this.kit.quality = this.settings.quality; }
    this.markTouches(time, fighters);
    this.launchTrails(time, fighters);
    if (DREAM_IMPACT) this.drawWindups(time, fighters);
    this.guard.update(time, dt, fighters); // Round 5 (PARRY)
    this.blast.update(time, fighters);
    this.holdVerdictGrades(fighters); // Round 3e (ULTFIX)
    this.core.uniforms.uTime.value = time; this.spirit.uniforms.uTime.value = time; this.violet.uniforms.uTime.value = time;
    const kit = this.kit;
    kit.beams.begin(time);
    for (const beam of this.downBeams) {
      const age = time - beam.born;
      if (age < 0 || age > .42) continue;
      const look = BEAM_LOOKS['taisei:special'];
      kit.beams.draw(beam.from, beam.to, age / .42, beam.seed, .55, look.shell, look.edge, 1);
      kit.lights.request(beam.to.x, beam.to.y + 1, beam.to.z, look.light, 22 * (1 - age / .42), 10, 2.5);
    }
    let kept = 0;
    for (let index = 0; index < this.casts.length; index++) {
      const c = this.casts[index];
      if (this.updateCast(c, time, dt, fighters)) this.casts[kept++] = c;
    }
    this.casts.length = kept;
    kept = 0;
    for (let index = 0; index < this.impacts.length; index++) {
      const impact = this.impacts[index];
      if (this.updateImpact(impact, time)) this.impacts[kept++] = impact;
      else this.releaseSlot(impact);
    }
    this.impacts.length = kept;
    kept = 0;
    for (let index = 0; index < this.glows.length; index++) { const g = this.glows[index]; if (this.updateGlow(g, time, fighters)) this.glows[kept++] = g; }
    this.glows.length = kept;
    this.weather.update(time, fighters, FLIGHTS);
    this.empress.update(time, fighters, FLIGHTS);
    this.chainsaw.update(time, fighters, FLIGHTS);
    this.berserker.update(time, fighters, FLIGHTS);
    this.rosterSignatures.update(time, fighters, FLIGHTS);
    this.areaCasts.update(time, fighters);
    this.pressure.update(time, fighters, FLIGHTS); this.explosions.update(time, fighters, FLIGHTS);
    this.cowling.update(time, fighters, FLIGHTS);
    this.magma.update(time, fighters, FLIGHTS);
    this.motion.update(time, fighters, kit, this.localId, this.screen);
    this.veil.update(time, dt, fighters);
    kit.track(fighters);
    kit.update(time, dt);
    if ((++this.frames & 63) === 0) kit.ghosts.retain(fighters);
  }
  private frames = 0;

  /** Round 3e (ULTFIX): a hit-confirm ultimate past its opener with the
   *  verdict still out - your own waits on the server's word now - keeps its
   *  grade OPENER_FEED at a time, and not a moment longer: a whiff clears the
   *  frame as soon as it is known, a confirm hands the grade to the
   *  cinematic's (`confirmed`). Your own and those cast near you, as the
   *  cast's own grade is (`technique`). Allocates nothing. */
  private holdVerdictGrades(fighters: Map<string, Fighter>) {
    const screen = this.screen;
    if (!screen || typeof screen.techniqueGrade !== 'function') return;
    const self = this.localId !== undefined ? fighters.get(this.localId) : undefined;
    for (const [id, fighter] of fighters) {
      const s = fighter.state;
      if (!s.alive || !undecided(s)) continue;
      const move = MOVES[s.fighter].ultimate;
      if (!move.confirm || s.actionTime * s.actionDuration < move.contacts[0] - .05) continue;
      const mine = id === this.localId || s.target === this.localId;
      const strength = (mine ? 1 : self && self.group.position.distanceTo(fighter.group.position) < 14 ? .5 : 0) * gradeStrength(s.fighter);
      if (strength > 0) screen.techniqueGrade(gradeHue(s.fighter, 'ultimate', !!s.awakened), strength, OPENER_FEED);
    }
  }

  /** One cast's frame. Returns false once it is over. */
  private updateCast(c: CastView, time: number, dt: number, fighters: Map<string, Fighter>) {
    const kit = this.kit;
    if(c.ownedMaterial)c.ownedMaterial.uniforms.uTime.value=time;
    const actor = fighters.get(c.event.actorId),move = c.ender ?? thrown(c.event.fighter!,c.event.slot!,c.event.branch,!!c.kurobi,!!actor?.state.awakened);
    const kazeyose=c.event.fighter==='konta'&&c.event.slot==='heavy'&&!c.kurobi&&(!c.event.branch||c.event.branch==='lllh');
    const poseAge=kazeyose&&actor?.state.action==='heavy'?actor.state.actionTime*actor.state.actionDuration:time-c.event.serverTime;
    // The local pose runs ahead of the presentation timeline. Switching back
    // to that older clock on recovery must never make the spent sphere regrow.
    const age=kazeyose?Math.max(c.presentedAge??-Infinity,poseAge):poseAge;
    if(kazeyose)c.presentedAge=age;
    const fired = move.style === 'beam' ? c.beamReleasedAt !== undefined && time >= c.beamReleasedAt : age >= c.release;
    if (c.weapon) c.weapon.visible = age >= c.release - .12;
    const projectile = move.style === 'projectile' || move.style === 'bomb';
    const isSpirit = c.event.fighter === 'taisei' && c.event.slot === 'ultimate';
    const life = kazeyose ? Math.min(c.duration,c.release+.38) : projectile ? c.release + c.travel + .08 : c.duration;
    // A sustained beam is still attached to the caster's active action after
    // contact. Free projectiles become independent once they have released.
    const attached=move.style==='beam'||move.style==='melee';
    // A confirmed beam stays visible for its bounded remaining lifetime
    // when fog hides its caster. Unreleased charges still cancel immediately.
    const interrupted = (attached || !c.released) && !(move.style==='beam'&&c.beamReleasedAt!==undefined&&!actor) && chargeWasCancelled(c.event, attached ? c.duration : c.release, actor?.state, time);
    if (age > life || age < -.1 || c.contactAt !== undefined && time >= c.contactAt || interrupted) {
      if (projectile && c.released && c.contactAt === undefined && !interrupted && age > life) this.miss(c, move, c.event.serverTime + c.release + c.travel);
      this.removeCast(c); return false;
    }
    if (actor && (!fired || attached || !c.released)) {
      actor.chargePosition(c.start);
      if(c.event.fighter==='ouga'&&c.event.slot==='light'&&c.contactIndex===1)c.start.copy(actor.handL);
      // The flaming kick is thrown from the foot, not the hand.
      if(c.event.fighter==='kosho')actor.meleeContactPoint(0,c.start);
      if (c.event.slot === 'ultimate'&&move.style==='bomb') {
        if(c.event.fighter==='konta'){
          // Konta's two hands carry the sphere overhead; Kurobi gathers
          // chi at its mouth. Freeze this socket once the throw releases.
          const size=(c.kurobi?FOXFIRE_ORB.kurobi:FOXFIRE_ORB.held)*(.14+.86*Math.pow(THREE.MathUtils.clamp(age/c.release,0,1),.8));
          if(!c.kurobi)c.start.addScaledVector(UP,size+.1);
          else c.start.addScaledVector(ORB_FORWARD.set(Math.sin(actor.state.yaw),.15,Math.cos(actor.state.yaw)),size*.7);
        }else if(c.event.fighter==='jinlin'){
          // The Drowned Sun grows on the finger he raises: over his left hand, its underside just clear of it.
          c.start.copy(actor.handL).addScaledVector(UP,DROWNED_SUN*(.14+.86*Math.pow(THREE.MathUtils.clamp(age/c.release,0,1),.8))+.12);
        }else c.start.copy(actor.group.position).addScaledVector(UP, isSpirit ? SPIRIT_HEIGHT : isSun(c.event.fighter,c.event.slot) ? SUN_HEIGHT : 2.8);
      }
    }
    c.group.position.copy(c.start);
    const charge = THREE.MathUtils.clamp(age / c.release, 0, 1);
    if(c.palmCharges&&actor){const gathering=age<c.release&&actor.handR.distanceTo(actor.handL)>.24;for(let i=0;i<2;i++){const palm=c.palmCharges[i];palm.visible=gathering;palm.position.copy(i?actor.handL:actor.handR);palm.scale.setScalar(.035+Math.min(1,age/1.4)*.065);}c.group.visible=!gathering;}
    let radius = c.event.slot === 'ultimate' ? (isSpirit ? SPIRIT_RADIUS : 2) * (.14 + .86 * Math.pow(charge, .8)) : .1 + charge * .23;
    if(c.event.fighter==='konta'){
      if(c.event.slot==='heavy'&&!c.event.branch)radius=(.035+THREE.MathUtils.smoothstep(age,.06,.48)*.18)*(1-THREE.MathUtils.smoothstep(age,c.release+.10,c.release+.38));
      // The Great Kazeyose: grown to twice the Kazeyose's size by its own contact, gone as quick after it.
      if(c.event.branch==='lllh'&&kazeyose)radius=bigBall(age,c.release);
      if(c.event.slot==='ultimate')radius=(c.kurobi?FOXFIRE_ORB.kurobi:FOXFIRE_ORB.held)*(.14+.86*Math.pow(charge,.8));
    }
    if(c.event.fighter==='ouga')radius=c.event.slot==='light'?.08+charge*.06:c.event.slot==='heavy'?.07+charge*.18:c.event.slot==='ultimate'?.05+charge*.11:.045+charge*.095;
    // Taisei's Sunpalm Cannon (8 October 2026): the ball is held in his cupped hands at the hip - at
    // the roster's default (a 0.66 m ball at full charge) it swallowed both hands and his side, and hung ahead of them.
    if(c.event.fighter==='taisei'&&c.event.slot==='special'&&(!c.event.branch||c.event.branch==='airSpecial'))radius=SUNPALM_BALL*(.3+.7*Math.pow(charge,.8));
    // Wuming's Withering Beam is charged the same way now, both hands cupped at his hip.
    if(c.event.fighter==='wuming'&&c.event.slot==='special'&&!c.event.branch)radius=SUNPALM_BALL*(.3+.7*Math.pow(charge,.8));
    if(c.event.fighter==='jinlin'&&c.event.slot==='ultimate')radius=DROWNED_SUN*(.14+.86*Math.pow(charge,.8));
    // The Sun-Seizing Spiral is drawn to a point at two fingertips, not gathered into a ball.
    if(c.event.fighter==='gohaku'&&c.event.slot==='ultimate')radius=.04+charge*.08;
    // An ember on the hand or the foot while the fire builds: the flames
    // are the charge, and a ball of ki the size of the fighter's head is
    // not what Signal Fire winds up with.
    const flame=FLAME_THROWERS.has(c.event.fighter!),sun=isSun(c.event.fighter,c.event.slot);
    if(sun)radius=SUN_RADIUS*(.12+.88*Math.pow(charge,.7));
    else if(flame)radius=.05+charge*.1;
    // Round 4b (FMOVES): no ball gathers on the GRAVEDIGGER for the Cleave's wave (GauntEffects draws it).
    if(c.event.fighter==='gaunt'&&c.event.slot==='heavy'&&!c.event.branch)radius=.001;
    const el = elementFor(c.event.fighter, c.event.slot, !!actor?.state.awakened, 0, c.event.branch);
    // Round 4b (FMOVES): a shot aimed as it is let go takes up the line its release gave - from where it is drawn when
    // that word comes after it has left the hand (a round trip late), not snapped across to the new line.
    if (c.aimed && !c.aimedDone && projectile) {
      c.aimedDone = true;
      if (fired && c.released) { c.start.lerp(c.end, Math.min(1, (age - c.release) / Math.max(.01, c.travel))); c.release = age; }
      c.end.copy(c.aimed); c.travel = c.start.distanceTo(c.end) / (move.speed ?? 50);
      c.group.position.copy(c.start);
    }
    // Round 8 (ULT AIM): a bomb aimed as it is let go is drawn coming down where the simulation will set it down.
    if (move.style === 'bomb' && move.aimOnRelease) this.followBomb(c, move, actor, fighters, age, dt, fired);
    if (fired && projectile) {
      if (!c.released && isSpirit) this.releaseFlash(c.start, c.event.serverTime + c.release);
      const p = Math.min(1, (age - c.release) / Math.max(.01, c.travel));
      radius = c.event.slot === 'ultimate' ? isSpirit ? SPIRIT_RADIUS : 2 : .65;
      if(c.event.fighter==='konta'&&c.event.slot==='special'&&!c.event.branch)radius=c.kurobi?.5:.38;
      // A main-game ender flies at its own size (ENDER_SIZE), a ki blast's otherwise; the Mini Galewheel smaller.
      if(c.event.branch&&c.ender){radius=ENDER_SIZE[c.event.fighter!]?.[c.event.branch]??(c.event.fighter==='konta'&&c.event.branch==='llls'?.26:.4);}
      if(c.event.fighter==='konta'&&c.event.slot==='ultimate')radius=c.kurobi?FOXFIRE_ORB.kurobi*.9:FOXFIRE_ORB.held;
      if(c.event.fighter==='ouga')radius=c.event.slot==='light'?.15:.55;
      // Vermilion Seal is one big sphere of his ki; the Drowned Sun goes as it was held.
      if(c.event.fighter==='banjaku'&&c.event.slot==='special')radius=.9;
      if(c.event.fighter==='jinlin'&&c.event.slot==='ultimate')radius=DROWNED_SUN;
      if(sun)radius=SUN_RADIUS;
      else if(flame)radius=c.event.fighter==='gummy'?.34:.26;
      // Round 4b (FMOVES): Gaunt' Cleave flies as GauntEffects' crescent, no ball; the Scrap Cannon Arm's shell is a hot round
      // a third of a metre across, not a ball of ki the size of a man.
      if(c.event.fighter==='gaunt'&&!c.event.branch)radius=c.event.slot==='heavy'?.001:.3;
      const visualEnd=this.direction.copy(c.end);
      // Preserve the server's original travel duration, but land the visible
      // lower surface above the floor instead of sinking a 1.8m globe into it.
      if(move.style==='bomb')visualEnd.y=c.end.y-1.05+radius+.03;
      c.group.position.lerp(visualEnd,p);
      // What the shot leaves behind it in flight: a trail of its own light,
      // unless another layer dresses it in fire or lightning.
      if (time >= c.nextTrail && !clockHandKnives(c.event) && !(isRoseEmpress(c.event.fighter)||isKuzuChainsaw(c.event.fighter)||isShakugoMagma(c.event.fighter)||isShanxiaoRampage(c.event.fighter)||rosterFlight(c.event.fighter,c.event.slot,c.event.branch,c.event.actorId)||isAmpereSurge(c.event.fighter)||isPyroclastExplosions(c.event.fighter)||isFullBeamPressure(c.event.fighter))) {
        c.nextTrail = time + (move.style === 'bomb' ? .05 : .028);
        const sp = kit.sparks.spec, pos = c.group.position;
        if (!FLIGHT_DRESSED.has(c.event.fighter!)) {
          sp.reset(SPRITE.glow, time, .26).at(pos).sized(radius * 1.6, radius * .6, .8).hot(el.rim, .9); kit.sparks.emit();
          sp.reset(SPRITE.streak, time, .22).pos(pos.x + (Math.random() - .5) * radius, pos.y + (Math.random() - .5) * radius, pos.z + (Math.random() - .5) * radius).velocity((Math.random() - .5) * 2, (Math.random() - .5) * 2 + .5, (Math.random() - .5) * 2);
          sp.orient = ORIENT.velocity; sp.sized(.03, .015, .5); sp.stretch = 2; sp.trail = .08; sp.drag = 2; sp.hot(el.spike, 1.4).cool(el.rim, 0); kit.sparks.emit();
        } else if (move.style !== 'bomb' && !(c.event.fighter === 'kagari' && c.event.slot === 'heavy' && !c.event.branch)) kit.puff(pos.x, pos.y, pos.z, (Math.random() - .5) * .5, .6, (Math.random() - .5) * .5, radius * 1.4, time, .45, .35); // (Round 4b: Yuragi's jet is fire to its root, GummyEffects')
        // The Water Dragon throws spray off itself as it goes; the Fireball rolls smoke and flame behind it.
        const wake = c.event.branch ? ENDER_TRAIL[c.event.fighter!]?.[c.event.branch] : undefined;
        if (wake === 'water') kit.smoke(pos.x, pos.y, pos.z, (Math.random() - .5) * 1.2, .4 + Math.random() * .6, (Math.random() - .5) * 1.2, radius * 1.3, time, .4, 0xeaf8ff, 0x5aa8e8);
        else if (wake === 'fire') kit.smoke(pos.x, pos.y, pos.z, (Math.random() - .5) * .8, .8, (Math.random() - .5) * .8, radius * 1.5, time, .35, 0xffb347, 0xd9481e);
      }
      // Faded in over its first metre and a half: at release the shot is
      // still in the caster's hand, and a light there burns them white.
      const clear = Math.min(1, c.group.position.distanceTo(c.start) / 1.5);
      if (!(isRoseEmpress(c.event.fighter)||isKuzuChainsaw(c.event.fighter)||isShakugoMagma(c.event.fighter)||isShanxiaoRampage(c.event.fighter)||rosterFlight(c.event.fighter,c.event.slot,c.event.branch,c.event.actorId)||isAmpereSurge(c.event.fighter)||isPyroclastExplosions(c.event.fighter)||isFullBeamPressure(c.event.fighter))) kit.lights.request(c.group.position.x, c.group.position.y, c.group.position.z, el.light, (c.event.slot === 'ultimate' ? 30 : c.event.slot === 'special' ? 12 : 7) * clear, c.event.slot === 'ultimate' ? 14 : 8, c.event.slot === 'ultimate' ? 2.5 : 1.5);
    }
    // The broad charging halo would cross the floor before the actual core.
    // In flight the saturated source core and its light carry the silhouette.
    const chargeHalo=c.group.getObjectByName('cast-energy-halo');
    if(chargeHalo)chargeHalo.visible=!(fired&&(projectile||move.style==='beam'));
    // Registered roster signatures suppress generic projectiles and require this same flight bridge.
    if((FLIGHT_DRESSED.has(c.event.fighter!)||hasRosterSignature(c.event.fighter,c.event.slot,c.event.branch,c.event.actorId)||clockHandKnives(c.event))&&projectile){
      // The thrown fire: where it is and which way it is going, for the
      // flames that dress it. The crescent leads the kick, facing its way.
      // LORD ORO's knives are dressed the same way, by SwordSpiritEffects.
      const key=flightKey(c);let flight=FLIGHTS.get(key);
      if(!flight){flight={fighter:c.event.fighter!,slot:c.event.slot!,branch:c.event.branch,actorId:c.event.actorId,position:new THREE.Vector3(),heading:new THREE.Vector3(),origin:new THREE.Vector3(),released:false,since:c.event.serverTime+c.release,awakened:!!actor?.state.awakened};FLIGHTS.set(key,flight);}
      // Follow the charging hand, then retain the actual launch point. Trails
      // must grow through travelled space instead of appearing behind the hand.
      if(!flight.released)flight.origin?.copy(c.start);
      flight.position.copy(c.group.position);flight.heading.copy(c.end).sub(c.start).setY(0);if(flight.heading.lengthSq()<1e-6)flight.heading.set(0,0,1);flight.heading.normalize();flight.released=fired;
      const crescent=c.group.getObjectByName('ram-crescent');
      if(crescent){crescent.visible=fired;c.group.quaternion.setFromUnitVectors(FORWARD,flight.heading);}
      const taimatsu=c.group.getObjectByName('taimatsu-taimatsu');
      if(taimatsu){
        taimatsu.visible=fired;c.group.getObjectByName('taimatsu-charge')!.visible=!fired;
        c.group.quaternion.setFromUnitVectors(FORWARD,flight.heading);
      }
    }
    if (!fired && (move.style === 'beam' || c.event.slot === 'ultimate') && age > 0 && time >= c.nextGather && !clockHandKnives(c.event) && !(isRoseEmpress(c.event.fighter)||isKuzuChainsaw(c.event.fighter)||isShakugoMagma(c.event.fighter)||isShanxiaoRampage(c.event.fighter)||rosterFlight(c.event.fighter,c.event.slot,c.event.branch,c.event.actorId)||isAmpereSurge(c.event.fighter)||isPyroclastExplosions(c.event.fighter)||isFullBeamPressure(c.event.fighter))) {
      // Energy drawn in toward the charge: streaks converging on the hands.
      c.nextGather = time + .05;
      const sp = kit.sparks.spec, reach = c.event.slot === 'ultimate' ? 3.2 : 1.6, span = .22;
      for (let i = 0; i < kit.n(2, 1); i++) {
        this.head.set(Math.random() - .5, Math.random() - .3, Math.random() - .5).normalize();
        sp.reset(SPRITE.streak, time, span).pos(c.start.x + this.head.x * reach, c.start.y + this.head.y * reach, c.start.z + this.head.z * reach);
        sp.velocity(-this.head.x * reach / span, -this.head.y * reach / span, -this.head.z * reach / span); sp.orient = ORIENT.velocity;
        sp.sized(.025, .01, .8); sp.stretch = 2; sp.trail = .05; sp.hot(el.spike, 1.3).cool(el.rim, 0); kit.sparks.emit();
      }
    }
    if (fired && move.style === 'beam') {
      radius = .075;
      const victim=c.hitTargetId?fighters.get(c.hitTargetId):undefined;
      if(c.hitEnd&&victim&&victim.group.parent){
        // The beam stays on the body it hit for as long as it burns: the blow
        // carries them down its length, and a head left at the first point of
        // contact burst on empty air while they flew. Held to the beam's line
        // and range, so a body thrown off to one side lets the beam go on.
        bodyCentre(victim,this.centre).addScaledVector(UP,.2);
        const along=this.beamDir.copy(c.end).sub(c.start),span=along.length();
        if(span>.01){along.divideScalar(span);const d=this.head.copy(this.centre).sub(c.start),t=d.dot(along);d.addScaledVector(along,-t);const off=d.length();
          // Along the beam's own line, bent toward the body by at most most
          // of its radius: the beam stays straight and stays on them.
          if(t>.5&&t<span+1&&off<move.radius*1.15)c.hitEnd.copy(c.start).addScaledVector(along,t).addScaledVector(d,off>1e-4?Math.min(1,move.radius*.7/off):0);
          else{c.hitEnd=undefined;c.hitTargetId=undefined;}}
      }
      this.drawBeam(c, move, age, time, el, actor);
    } else if (!fired && move.style !== 'melee' && !clockHandKnives(c.event) && !(isRoseEmpress(c.event.fighter)||isKuzuChainsaw(c.event.fighter)||isShakugoMagma(c.event.fighter)||isShanxiaoRampage(c.event.fighter)||rosterFlight(c.event.fighter,c.event.slot,c.event.branch,c.event.actorId)||isAmpereSurge(c.event.fighter)||isPyroclastExplosions(c.event.fighter)||isFullBeamPressure(c.event.fighter))) {
      // Rising to the release, not switched on: the room fills with the
      // technique's colour as the charge builds.
      const strength = Math.pow(Math.min(1, Math.max(0, age / c.release)), 1.4);
      const glow = techniqueColour(c.event.fighter!, c.event.slot!, !!actor?.state.awakened, c.event.branch);
      // A bomb gathers metres over its caster's head, so it throws harder to
      // reach the floor. A charge in the palms is lit from a metre and a
      // quarter ahead of them, toward the target: a light in the hands burns
      // the caster white and lights nothing else.
      const high = move.style === 'bomb', at = this.chargeLight(c, high);
      kit.lights.request(at.x, at.y, at.z, glow, (high ? 50 : c.event.slot === 'ultimate' ? 18 : c.event.slot === 'special' ? 13 : 7) * (.1 + .9 * strength), high ? 16 : c.event.slot === 'ultimate' ? 12 : 9, c.event.slot === 'ultimate' ? 2.5 : 2);
    } else if (kazeyose && age < c.release + .38) { const at = this.chargeLight(c, false); kit.lights.request(at.x, at.y, at.z, 0x5fd4ff, 8, 6, 2); }
    if (move.style === 'melee' && age > c.release) c.group.visible = radius>.005;
    c.group.scale.setScalar(radius * (1 + .012 * Math.sin(time * 43)));
    const wind=c.group.getObjectByName('galewheel-gust-darts');
    if(wind){
      this.windMaterial.uniforms.uTime.value=time;
      // A shallow tilted disc rests above the palm. The core remains round;
      // the four broad wind blades keep spinning through the throw.
      this.direction.copy(c.end).sub(c.start).setY(0).normalize();
      if(this.direction.lengthSq()>.001)c.group.quaternion.setFromUnitVectors(FORWARD,this.direction);
      // Turn the tilted overhead blade into the open face of the throw,
      // so it never becomes a pair of needles travelling down the lens.
      c.group.rotateX(-Math.PI*.34*(1-THREE.MathUtils.smoothstep(age-c.release,-.22,.10)));
      wind.rotation.z=time*38;
    }
    for (let i = 0; i < c.rings.length; i++) {
      const ring = c.rings[i];
      ring.visible=!(fired&&move.style==='bomb');
      ring.rotation.x += dt * (3 + i); ring.rotation.z -= dt * (5 + i); ring.scale.setScalar(1.06 + i * .1);
      if (c.event.slot === 'special' && c.event.fighter === 'konta' && fired) ring.scale.set(3.2, 3.2, .5);
    }
    if (c.streams) {
      c.streams.visible = !fired; c.streams.count = Math.max(5, Math.floor(14 * Math.min(1, kit.budget)));
      for (let i = 0; i < c.streams.count; i++) {
        const angle = i * 2.399963 + (c.event.seed ?? 0) * .00001;
        this.direction.set(Math.cos(angle), .2 + Math.sin(i * 2.17) * .8, Math.sin(angle)).normalize();
        const phase = (age * (.8 + i % 3 * .13) + i * .37) % 1;
        this.scratch.position.copy(this.direction).multiplyScalar(1.02 + (1 - phase) * 1.35);
        this.scratch.quaternion.setFromUnitVectors(UP, this.direction.negate());
        this.scratch.scale.set(.011, .2 + phase * .27, .011); this.scratch.updateMatrix();
        c.streams.setMatrixAt(i, this.scratch.matrix);
      }
      c.streams.instanceMatrix.needsUpdate = true;
    }
    c.released ||= fired; return true;
  }

  /** Round 3c (LOCK): whether `event` is `cast`'s release. On time, as
   *  before, for anything; and late as well for a beam that has not burned
   *  yet. The simulation holds a cast's clock while its thrower's commands
   *  are late (up to 0.35 s) and through an impact freeze, so a beam can come
   *  out well after its nominal contact - and matched on time alone it was
   *  never drawn while its damage landed: a 0.25 s hitch in Royal Aurora's
   *  charge, or Sunpalm Cannon's, burned its victims with no beam on screen. A
   *  late beam's clock moves with its release, so it burns as long as ever. */
  private releases(cast: CastView, event: CombatEvent) {
    const late = event.serverTime - cast.event.serverTime - cast.release, RELEASE_LATE = 1;
    if (Math.abs(late) < .06) return true;
    if (late <= 0 || late > RELEASE_LATE || cast.beamReleasedAt !== undefined
      || thrown(cast.event.fighter!, cast.event.slot!, cast.event.branch, !!cast.kurobi).style !== 'beam') return false;
    cast.release += late; cast.duration += late;
    return true;
  }

  /** Where a charge's light goes: over a bomb, where it gathers, or ahead
   *  of the hands toward the cast's target and a little above them, where
   *  it lights the floor between the fighters and both of their fronts. */
  private chargeLight(c: CastView, high: boolean) {
    const at = this.head.copy(c.group.position);
    if (high) return at;
    this.beamDir.copy(c.end).sub(c.start).setY(0);
    if (this.beamDir.lengthSq() < 1e-6) return at.setY(at.y + 1);
    this.beamDir.normalize();
    return at.addScaledVector(this.beamDir, .8).setY(at.y + .6);
  }

  /** The LAST SUN leaving Taisei's hands. */
  private releaseFlash(at: THREE.Vector3, time: number) {
    const sp = this.kit.sparks.spec;
    sp.reset(SPRITE.flare, time, .25).at(at).sized(2, 4, .3).hot(0xffffff, 1.4).cool(0x6fd8ff); this.kit.sparks.emit();
    this.kit.ring(at.x, at.y, at.z, 1.5, 4.5, time, .35, 0xffffff, 0x2d9bff, .1);
    this.impacts.push({ born: time, duration: .23, size: .65, energy: true, seed: 1 });
  }

  /** A beam's frame: the tube and corona, and everything it keeps throwing
   *  off - a white-hot ball in the palms, sparks crackling off its length,
   *  rings racing down it, and at the far end a burst that does not stop
   *  until the beam does. It lights the room from both ends and the middle. */
  private drawBeam(c: CastView, move: MoveDefinition, age: number, time: number, el: Element, actor?: Fighter) {
    // Tsubute uses a ranged confirm volume in the simulation. His three slingshot
    // releases are seed tracers, never the common sustained energy tube.
    if(c.event.fighter==='tsubute'&&rosterFlight(c.event.fighter,c.event.slot,c.event.branch,c.event.actorId))return;
    const key = c.event.branch ? `${c.event.fighter}:${c.event.branch}` : `${c.event.fighter}:${c.event.slot}`, kit = this.kit, look = BEAM_LOOKS[key] ?? (BEAM_LOOKS[key] = { shell: el.rim, edge: el.ink, light: el.light, spike: el.spike, scale: .85 });
    const end = c.hitEnd ?? c.end, life = (age - c.release) / Math.max(.01, c.duration - c.release);
    const hitting = !!c.hitEnd, contact = hitting || c.surface;
    const radius = move.radius * look.scale;
    if (!kit.beams.draw(c.start, end, life, c.event.seed ?? 1, radius, look.shell, look.edge, contact ? 1 : .35)) return;
    const fade = life < .8 ? 1 : Math.max(0, 1 - (life - .8) / .2);
    const reach = kit.beams.reach(life), dir = this.beamDir.copy(end).sub(c.start), span = dir.length();
    if (span < .01) return;
    dir.divideScalar(span);
    const head = this.head.copy(c.start).addScaledVector(dir, span * reach), sp = kit.sparks.spec;
    const ultimate = c.event.slot === 'ultimate', mine = c.event.actorId === this.localId ? 1 : 0, lit = (look.lit ?? 1) * fade;
    // Three of the four pool lights, in the beam's colour: the palms, the
    // middle of its length and the point it is burning into. The key light
    // is about 5, so a beam throws several times that.
    // Not in the palms, where it would burn the caster white: a metre and a
    // half down the beam, and half way along it.
    const near = Math.min(1.6, span * reach * .5);
    kit.lights.request(c.start.x + dir.x * near, c.start.y + dir.y * near + .2, c.start.z + dir.z * near, look.light, (ultimate ? 26 : 20) * lit, 10, 3 + mine);
    kit.lights.request(c.start.x + dir.x * span * reach * .5, c.start.y + dir.y * span * reach * .5 + .3, c.start.z + dir.z * span * reach * .5, look.light, (ultimate ? 24 : 18) * lit, 10, 2.5 + mine);
    if (time >= c.nextMuzzle) {
      c.nextMuzzle = time + .07;
      sp.reset(SPRITE.core, time, .1).at(c.start).sized(radius * .8, radius * 1.1, .3).hot(0xffffff, 2.4 * fade).cool(look.shell); kit.sparks.emit();
      sp.reset(SPRITE.flare, time, .12).at(c.start).sized(radius * 1.2, radius * 1.9, .3).hot(0xffffff, .9 * fade).cool(look.shell); sp.rotation = Math.random() * .6; kit.sparks.emit();
      if (fade > .3) {
        // Rings travelling down the beam, to show its speed.
        sp.reset(SPRITE.ring, time, Math.min(.32, span / 34)).pos(c.start.x + dir.x * 1.2, c.start.y + dir.y * 1.2, c.start.z + dir.z * 1.2).velocity(dir.x * 34, dir.y * 34, dir.z * 34);
        sp.orient = ORIENT.plane; sp.axis(dir.x, dir.y, dir.z); sp.sized(radius * 1.1, radius * 1.4, .8).hot(0xffffff, 1.3).cool(look.shell, .05); kit.sparks.emit();
        // Crackle off its skin, all along it.
        const bloom = BEAM_ELEMENTS[key] ?? (BEAM_ELEMENTS[key] = { spike: look.spike, rim: look.shell, light: look.light, ink: look.edge });
        kit.crackle(c.start, head, radius * 1.02, bloom, kit.n(5, 2), time);
      }
    }
    if (reach < .97) return;
    // A metre back up the beam from its head, which is on the body it hit.
    kit.lights.request(head.x - dir.x * 1.1, head.y - dir.y * 1.1 + .3, head.z - dir.z * 1.1, look.light, (contact ? 26 : 12) * lit, contact ? 12 : 9, 3 + mine);
    if (!contact || fade < .15) return;
    const bloom = BEAM_ELEMENTS[key] ?? (BEAM_ELEMENTS[key] = { spike: look.spike, rim: look.shell, light: look.light, ink: look.edge });
    if (time >= c.nextSpark) {
      c.nextSpark = time + .09;
      sp.reset(SPRITE.star, time, .18).at(head).sized(radius * .9, radius * 2.4, .25).hot(look.spike, 1.3).cool(look.shell, .45); sp.rotation = Math.random() * 6.28; sp.bias = radius * .8; kit.sparks.emit();
      sp.reset(SPRITE.core, time, .08).at(head).sized(radius * .9, radius * 1.4, .3).hot(0xffffff, 2.2).cool(look.shell); sp.bias = radius; kit.sparks.emit();
      kit.streaks(head.x, head.y, head.z, bloom, kit.n(7, 2), 13, .035, time, this.blow.copy(dir).negate(), .45);
      // The dream loop: the beam goes off in cel clouds where it burns in, all the while it pushes.
      if (DREAM_IMPACT) kit.explosion(head.x - dir.x * radius, head.y - dir.y * radius, head.z - dir.z * radius, bloom, radius * (ultimate ? 2.2 : 1.7), time, ultimate ? 4 : 3);
    }
    if (time >= c.nextRing) { c.nextRing = time + .15; kit.ring(head.x, head.y, head.z, radius, radius * 4, time, .28, 0xffffff, look.shell, .06); }
    const floor = c.floor, nearFloor = head.y - floor < 2.4;
    const wall = c.surface && !hitting && end.y - floor > .45;
    if (time >= c.nextRock && (c.surface || nearFloor)) {
      c.nextRock = time + .11;
      if (wall) kit.debris.burst(kit.n(2, 1), head.x, head.y, head.z, -dir.x, 0, -dir.z, 8, .8, .12, floor, 1.8);
      else kit.debris.burst(kit.n(2, 1), head.x, floor, head.z, 0, 1, 0, 7, .7, .12, floor, 1.8);
      // Lit by the beam: a cream cloud under a blue beam reads as a rock.
      this.scratchColor.setHex(DUST_LIT).lerp(this.tint.setHex(look.light), .45);
      kit.smoke(head.x, floor + .25, head.z, (Math.random() - .5) * 4, .8, (Math.random() - .5) * 4, .5, time, .38, this.scratchColor.getHex(), DUST_SHADE);
    }
    if (!c.scorched && (wall || nearFloor)) {
      c.scorched = true;
      if (wall) { kit.scorch(end.x, end.y, end.z, -dir.x, 0, -dir.z, radius * 3, time, look.light); kit.groundImpact(end.x, end.y, end.z, -dir.x, 0, -dir.z, 2, time, bloom, floor); }
      else { kit.scorch(head.x, floor, head.z, 0, 1, 0, radius * 3.2, time, look.light); kit.groundImpact(head.x, floor, head.z, 0, 1, 0, 2, time, bloom, floor); }
    }
  }

  /** One burst's frame. Returns false once it is over. */
  private updateImpact(impact: Impact, time: number) {
    const t = (time - impact.born) / impact.duration;
    if (t > 1) return false;
    const slot = impact.slot;
    if (!slot) return true;
    slot.group.visible = t >= 0;
    if (impact.follow && impact.offset && impact.follow.group.parent) slot.group.position.copy(bodyCentre(impact.follow, this.centre)).add(impact.offset);
    const age = Math.max(0, time - impact.born), ultimate = !!impact.ultimate;
    const shellDuration = slot.shell.material.uniforms.uDuration.value as number;
    const swell = 1 - Math.pow(1 - Math.min(1, age / (ultimate?.22:shellDuration)), 2);
    if(ultimate){
      slot.shell.scale.set(impact.size*(1+swell*.44),impact.size*(1+swell*.20),impact.size*(1+swell*.38));
      slot.shell.material.uniforms.uFloor.value=(-impact.size+.03)/slot.shell.scale.y;
    }else slot.shell.scale.setScalar(impact.size*(1+swell*.9));
    slot.shell.visible = age < shellDuration;
    slot.shell.material.uniforms.uAge.value = age;
    slot.shell.material.uniforms.uTime.value = time; slot.shell.material.uniforms.uFade.value = VFX.shells;
    if (ultimate) {
      const wave = slot.pressure.material.uniforms;
      const advance = 1 - Math.pow(1 - Math.min(1, age / .66), 2);
      wave.uAge.value = age; wave.uTime.value = time;
      wave.uFront.value = impact.size * .86 + advance * 5.9;
      wave.uWidth.value = .4 + advance * .45;
      wave.uLift.value = .58 * (1 - Math.min(1, age / 1.1));
    }
    const streakLife = ultimate ? .36 : .28, streakAge = Math.min(1, age / streakLife);
    slot.streaks.visible = age < streakLife;
    slot.rim.opacity = ultimate?1-THREE.MathUtils.smoothstep(age,.10,.36):Math.pow(1-streakAge,1.6)*.9;
    for (let i = 0; i < slot.streaks.count; i++) {
      const angle = i * 2.399963 + impact.seed * .11;
      this.direction.set(Math.cos(angle), ultimate ? -.16 + (i % 5) * .24 : Math.sin(i * 2.17) * .65, Math.sin(angle)).normalize();
      const speed = (ultimate ? 4.8 : 4) + i % 3;
      this.scratch.position.copy(this.direction).multiplyScalar(impact.size * .65 + age * speed);
      this.scratch.quaternion.setFromUnitVectors(UP, this.direction);
      const width = (ultimate ? .07+(i%3)*.025 : .026) * (1 - streakAge * .65);
      const length=(ultimate ? 1.75 : .5) * (1 + i % 3 * (ultimate?.13:.24)) * (1 - streakAge * .65);
      this.scratch.scale.set(width,length,width);
      // Keep each complete cone above the projected floor, including its
      // broad base, while its seeded direction carries it out of the mass.
      if(ultimate)this.scratch.position.y=Math.max(this.scratch.position.y,-impact.size+.04+Math.abs(this.direction.y)*length*.5+width);
      this.scratch.updateMatrix(); slot.streaks.setMatrixAt(i, this.scratch.matrix);
    }
    slot.streaks.instanceMatrix.needsUpdate = true;
    slot.ink.visible = slot.streaks.visible; slot.inkMaterial.opacity = slot.rim.opacity * .95;
    if(ultimate)this.updateGroundDust(impact,slot,time);
    return true;
  }

  private updateGroundDust(impact:Impact,slot:BurstSlot,time:number){
    const age=Math.max(0,time-impact.born);
    const life=1.05,p=THREE.MathUtils.clamp(age/life,0,1),growth=1-Math.pow(1-p,2);
    const ground=-impact.size+.015;
    const dust=slot.dust;dust.visible=age<life;
    dust.material.uniforms.uTime.value=time;dust.material.uniforms.uAge.value=age;
    dust.material.uniforms.uOpacity.value=.9*(1-THREE.MathUtils.smoothstep(p,.26,1));
    dust.count=Math.max(4,Math.floor(12*Math.min(1,this.kit.budget)));
    for(let i=0;i<dust.count;i++){
      const angle=i*2.399963+impact.seed*.13,radial=.55+growth*3.3+(i%3)*.08;
      this.scratch.position.set(Math.cos(angle)*radial,ground+.12+Math.sin(p*Math.PI)*(.18+i%3*.08),Math.sin(angle)*radial);
      this.scratch.quaternion.identity();
      const width=.34+growth*.5;
      this.scratch.scale.set(width,.13+growth*.26,width*(.75+i%3*.1));
      this.scratch.updateMatrix();dust.setMatrixAt(i,this.scratch.matrix);
    }
    dust.instanceMatrix.needsUpdate=true;
    const debris=slot.debris;debris.visible=age<.8;
    slot.debrisMaterial.opacity=1-THREE.MathUtils.smoothstep(age,.3,.8);
    for(let i=0;i<debris.count;i++){
      const angle=i*2.399963+impact.seed*.13,radial=.55+age*(3.4+i%3*.65);
      this.direction.set(Math.cos(angle),.2,Math.sin(angle)).normalize();
      this.scratch.position.set(Math.cos(angle)*radial,ground+.08+Math.max(0,age*(2.4+i%3*.55)-age*age*4),Math.sin(angle)*radial);
      this.scratch.quaternion.setFromAxisAngle(this.direction,age*(6+i%3));
      this.scratch.scale.set(.11+i%3*.025,.18+i%2*.09,.08+i%3*.018);
      this.scratch.updateMatrix();debris.setMatrixAt(i,this.scratch.matrix);
    }
    debris.instanceMatrix.needsUpdate=true;
  }

  reset() {
    this.casts.forEach(c => this.removeCast(c)); this.impacts.forEach(i => this.releaseSlot(i));
    for (const beam of this.downBeams) beam.born = -9;
    this.casts = []; this.impacts = []; this.seen.clear(); this.kontaHeavyCasts.clear(); this.detonations.clear(); FLIGHTS.clear();
    this.touchSparks.clear(); this.touchSeen = Fighter.touchLog.at(-1)?.serial ?? this.touchSeen; this.lastPanel = -1e9;
    this.kit.clear(); this.motion.clear(); this.blast.reset(); this.guard.reset(); this.weather.reset(); this.empress.reset(); this.chainsaw.reset(); this.magma.reset(); this.berserker.reset(); this.cowling.reset(); this.pressure.reset(); this.explosions.reset(); this.rosterSignatures.reset(); this.areaCasts.reset();
    // A new room: nothing landed in the last one stands (see LANDED).
    LANDED.reset();
  }
  dispose() {
    this.reset();
    for (const slot of this.slots) {
      slot.group.removeFromParent(); slot.streaks.dispose(); slot.ink.dispose(); slot.dust.dispose(); slot.debris.dispose();
      for (const m of [slot.rim, slot.inkMaterial, slot.shell.material, slot.pressure.material, slot.dust.material, slot.debrisMaterial]) m.dispose();
    }
    this.slots = []; this.blast.dispose();
    const shared = new Set<THREE.Material>([this.core, this.spirit, this.violet, this.halo, this.cyan, this.crescentMaterial, this.windMaterial]);
    if (this.warm) { this.warm.removeFromParent(); this.warm.traverse(o => { const m = (o as THREE.Mesh).material as THREE.Material | undefined; if (m && !shared.has(m)) m.dispose(); }); this.warm = undefined; }
    [this.sphere, this.fistGeometry, this.ring, this.windBlade, this.pressureGeometry, this.spark, this.inkGeometry, this.crescentGeometry].forEach(g => g.dispose());
    shared.forEach(m => m.dispose());
    this.guard.dispose(); this.weather.dispose(); this.empress.dispose(); this.chainsaw.dispose(); this.magma.dispose(); this.berserker.dispose(); this.cowling.dispose(); this.pressure.dispose(); this.explosions.dispose(); this.rosterSignatures.dispose(); this.areaCasts.dispose();
    this.kit.release();
  }
}
